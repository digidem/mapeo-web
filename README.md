# mapeo-web

> A small sync and storage service for Mapeo maps.

[Mapeo] is a peer-to-peer [local-first] collaborative mapping technology. Laptops and phones can sync map data to each other directly, either by finding each other on the local network, or by syncing to a USB key ([sneakernet]-style) that can then be synced to other devices.

Mapeo Web is a small web service that provides hosting for Mapeo projects. It does this by advertising itself on the internet (and local network) as a regular Mapeo peer, which [Mapeo Desktop] and [Mapeo Mobile] can sync with. It also exposes a web interface that lets you customize which Mapeo projects are hosted by it.

Additionally, to facilitate limited sharing of map data, project owners can share specialty GeoJSON export URLs from filters created by [Mapeo Desktop].

## Usage

With [NodeJS and npm] installed, run in a terminal:

```
npm install --global mapeo-web
```

and then

```
mapeo-web
```

This will output a URL of where the service is running. You can plug any Mapeo project ID into it and have it begin being hosted.

## Security

A *Mapeo Project ID* acts as a symmetric encryption key. This means, whoever this ID is shared with can:

- locate peers of this project on the local network or internet who are online & advertising their membership
- write new map data to the project
- read map data from the project
- sync with those peers (download & upload map data)

So! This ID is very important. It needs to be treated as sensitive information. Any Project ID you enter into a Mapeo Web instance will give the operator of that service access to all of your data. Please be mindful of this.

Mapeo Web allows project owners to generate special GeoJSON export URLs. These URLs are obfuscated so that someone who has the URL will *not* be able to figure out what the original Project ID that the filter came from was. This is a safe way to control data sharing of a subset of your map data with 3rd parties.

*For those who this makes sense to, Mapeo Web uses the `blake2b` hashing algorithm to hide the original Project ID.*

## Setting up on a Digital Ocean Droplet

- Set up Node.js [with this guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04)
- Set up Nginx [with this guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04)
- Install mapeo-web with `npm i -g digidem/mapeo-web#ws-rewrite`
- You can run the server with `mapeo-web start --port 62736`. 62736 is `MAPEO` on a dialpad
- You can set up a service for it in the background with this:

```
# Paste this into an interactive bash or zsh shell, or save it as a file and run it with sh.

# This will create the service file.
sudo cat << EOF | sudo tee /etc/systemd/system/mapeo-web.service > /dev/null
[Unit]
Description=Mapeo Web sync server

[Service]
Type=simple
ExecStart=$(which mapeo-web) start --port 62736
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo chmod 644 /etc/systemd/system/mapeo-web.service

sudo systemctl daemon-reload
sudo systemctl enable mapeo-web
sudo systemctl start mapeo-web

sudo systemctl status mapeo-web
```

- Add an nginx config file: `/etc/nginx/sites-enabled/cloud.mapeo.app`

```
server {
  server_name cloud.mapeo.app;

  location / {
    proxy_pass http://localhost:62736;
    proxy_set_header    Host            $host;
    proxy_set_header    X-Real-IP       $remote_addr;
    proxy_set_header    X-Forwarded-for $remote_addr;
    port_in_redirect    off;
    proxy_http_version  1.1;
    proxy_set_header    Upgrade         $http_upgrade;
    proxy_set_header    Connection      "Upgrade";
  }
}
```

- Restart the server with `service nginx reload`
- Enable HTTPs with LetsEncrypt with [this guide](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04)
- BAM! https://cloud.mapeo.app/

## License

ISC

[Mapeo]: https://mapeo.world
[local-first]: https://www.inkandswitch.com/local-first.html
[sneakernet]: https://en.wikipedia.org/wiki/Sneakernet
[Mapeo Desktop]: https://github.com/digidem/mapeo-desktop
[Mapeo Mobile]: https://github.com/digidem/mapeo-mobile
[NodeJS and npm]: https://nodejs.org
