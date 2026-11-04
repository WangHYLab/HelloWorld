# 使用官方 Node.js 20 轻量级镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 暴露端口（假设你的应用使用 3000，请根据 server.js 中的实际端口修改）
EXPOSE 3000

# 启动命令（请确认与 package.json 中的 start 脚本一致）
CMD ["npm", "start"]