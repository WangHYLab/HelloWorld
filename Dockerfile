FROM node:20-alpine

# 1. 安装原生模块编译所需的工具
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 2. 分步复制依赖文件
COPY package*.json ./

# 3. 安装生产依赖（使用 npm install 规避 npm ci 的潜在问题）
RUN npm install --omit=dev

# 4. 复制源代码
COPY . .

# 5. 暴露端口（请确认与“Port to forward”中设置的一致，例如 3000）
EXPOSE 3000

# 6. 启动命令
CMD ["npm", "start"]