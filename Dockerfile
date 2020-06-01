FROM fedora

RUN dnf install -y \
  make \
  automake \
  gcc \
  gcc-c++ \
  kernel-devel
RUN dnf install -y \
  nodejs \
  npm \
  opus \
  libopusenc \
  curl \
  openssl
RUN npm install --global yarn

WORKDIR /usr/src/app

COPY package.json ./
RUN yarn install
COPY . .

CMD [ "node", "index.js" ]
