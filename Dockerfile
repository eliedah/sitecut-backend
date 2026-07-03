FROM ghcr.io/osgeo/gdal:ubuntu-small-latest

# Node 20, DuckDB CLI, Python climate deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip python3-pip \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && pip3 install --break-system-packages cdsapi xarray netcdf4 \
 && curl -L https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip -o /tmp/d.zip \
 && unzip /tmp/d.zip -d /usr/local/bin && rm /tmp/d.zip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 8080
CMD ["node", "src/server.js"]
