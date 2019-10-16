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

## License

ISC

[Mapeo]: https://mapeo.world
[local-first]: https://www.inkandswitch.com/local-first.html
[sneakernet]: https://en.wikipedia.org/wiki/Sneakernet
[Mapeo Desktop]: https://github.com/digidem/mapeo-desktop
[Mapeo Mobile]: https://github.com/digidem/mapeo-mobile
[NodeJS and npm]: https://nodejs.org
