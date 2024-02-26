import { config } from "dotenv";
config();

import express, { Request, Response } from "express";
import cors from "cors";
import { PgPromiseAdapter } from "./infra/database/PgPromiseAdapter";

const app = express();
app.use(cors());
app.use(express.json());

console.log("APP_PORT: ", process.env.APP_PORT);
console.log("DATABASE_URL: ", process.env.DATABASE_URL);

const appPort = process.env.APP_PORT || 3000;

const connection = new PgPromiseAdapter();

app.get("/clientes", async (req: Request, res: Response) => {
  const clientes = await connection.query("SELECT * FROM clientes ORDER BY id");
  const transacoes = await connection.query("SELECT * FROM transacoes");

  const clientesComTransacoes = clientes.map((cliente: any) => {
    return {
      ...cliente,
      transacoes: transacoes.filter(
        (transacao: any) => transacao.cliente_id === cliente.id
      ),
    };
  });

  return res.status(200).send(clientesComTransacoes);
});

app.get("/clientes/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const cliente = await connection.query(
    "SELECT * FROM clientes WHERE id = $1",
    [id]
  );

  if (cliente.length === 0) {
    return res.status(404).send({ message: "Cliente não encontrado" });
  }

  const transacoes = await connection.query(
    "SELECT * FROM transacoes WHERE cliente_id = $1 ORDER BY realizada_em DESC LIMIT 10",
    [id]
  );

  cliente[0].transacoes = transacoes;

  return res.status(200).send(cliente[0]);
});

app.post("/clientes", async (req: Request, res: Response) => {
  const { limite, saldo, nome } = req.body;
  const cliente = await connection.query(
    "INSERT INTO clientes (nome, saldo, limite) VALUES ($1, $2, $3) RETURNING *",
    [nome, saldo, limite]
  );
  return res.status(201).send(cliente[0]);
});

app.post("/clientes/:id/transacoes", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { valor, tipo, descricao } = req.body;

  if (
    !id ||
    !valor ||
    valor <= 0 ||
    !Number.isInteger(valor) ||
    !["c", "d"].includes(tipo) ||
    !descricao
  ) {
    return res.status(422).send({ message: "Parâmetros invalidos" });
  }

  const cliente = await connection.query(
    "SELECT * FROM clientes WHERE id = $1",
    [id]
  );

  if (cliente.length === 0) {
    return res.status(404).send({ message: "Cliente não encontrado" });
  }

  if (tipo === "c") {
    const response = await connection.query(
      "UPDATE clientes SET saldo = saldo + $1 WHERE id = $2 RETURNING limite, saldo",
      [valor, id]
    );

    await connection.query(
      "INSERT INTO transacoes (valor, tipo, descricao, cliente_id) VALUES ($1, $2, $3, $4)",
      [valor, tipo, descricao, id]
    );

    return res.status(200).send({
      limite: response[0].limite,
      saldo: response[0].saldo,
    });
  }

  const valorMaximoADebitar = cliente[0].limite + cliente[0].saldo;

  if (valor > valorMaximoADebitar) {
    return res.status(422).send({ message: "Saldo insuficiente" });
  }

  const response = await connection.query(
    "UPDATE clientes SET saldo = saldo - $1 WHERE id = $2 RETURNING limite, saldo",
    [valor, id]
  );

  await connection.query(
    "INSERT INTO transacoes (valor, tipo, descricao, cliente_id) VALUES ($1, $2, $3, $4)",
    [valor, tipo, descricao, id]
  );

  return res.status(200).send({
    limite: response[0].limite,
    saldo: response[0].saldo,
  });
});

app.get("/clientes/:id/extrato", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(422).send({ message: "Parâmetros invalidos" });
  }

  const cliente = await connection.query(
    "SELECT * FROM clientes WHERE id = $1",
    [id]
  );

  if (cliente.length === 0) {
    return res.status(404).send({ message: "Cliente não encontrado" });
  }

  const transacoes = await connection.query(
    "SELECT * FROM transacoes WHERE cliente_id = $1 ORDER BY realizada_em DESC LIMIT 10",
    [id]
  );

  return res.status(200).send({
    saldo: {
      total: cliente[0].saldo,
      limite: cliente[0].limite,
      data_extrato: new Date(),
    },
    ultimas_transacoes: transacoes,
  });
});

app.listen(appPort, () => {
  console.info(`Server is running on port ${appPort}`);
});
