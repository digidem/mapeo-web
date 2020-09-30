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

## Testing

Where pid is a valid Mapeo Project ID (32 random bytes)


```
mkdir projects
mkdir projects/<pid>
npm start
node test/sync.js <pid>
```


## Security

A *Mapeo Project ID* acts as a symmetric encryption key. This means, whoever this ID is shared with can:

- locate peers of this project on the local network or internet who are online & advertising their membership
- write new map data to the project
- read map data from the project
- sync with those peers (download & upload map data)

So! This ID is very important. It needs to be treated as sensitive information.
Any Project ID you enter into a Mapeo Web instance will give the operator of
that service access to all of your data. Please be mindful of this.

Mapeo Web allows project owners to generate special GeoJSON export URLs. These
URLs are obfuscated so that someone who has the URL will *not* be able to
figure out what the original Project ID that the filter came from was. This is
a safe way to control data sharing of a subset of your map data with 3rd
parties.

*For those who this makes sense to, Mapeo Web uses the `blake2b` hashing algorithm to hide the original Project ID.*

## License

ISC

[Mapeo]: https://mapeo.world
[local-first]: https://www.inkandswitch.com/local-first.html
[sneakernet]: https://en.wikipedia.org/wiki/Sneakernet
[Mapeo Desktop]: https://github.com/digidem/mapeo-desktop
[Mapeo Mobile]: https://github.com/digidem/mapeo-mobile
[NodeJS and npm]: https://nodejs.org
