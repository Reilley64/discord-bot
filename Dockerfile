FROM node:lts-alpine

RUN apk update
RUN apk add opus

WORKDIR /usr/src/app

COPY package.json ./
RUN yarn install
COPY . .

CMD [ "node", "index.js" ]
