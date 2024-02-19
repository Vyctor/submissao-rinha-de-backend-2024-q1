FROM node:21 

COPY . .
RUN npm install

CMD ["npm", "run", "dev"]