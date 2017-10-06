## Node Arlo API

An API library for Node.js that interacts with Netgear's Arlo camera system.

The API is not complete yet and at the moment mainly used for personal
purposes only. I will continue completing the API and also adding more
documentation and examples.

Some example usage is already shown in node-arlo-cli which can be started
as follows:

```
node node-arlo-cli -u 'ARLO_USERNAME' -p 'ARLO_PASSWORD'
```

You still will be prompted providing username and password whereas the defaults
are those passed.

The example shows how to derive device information, arm or disarm the system.
This should provide a basic understand of using the API in general.

# Example based on arlo-api.js

If you just want to copy the contents of arlo-api.js and use that, here's how it
might look within your app:

```
import ArloApi from 'arlo';

const arlo = new ArloApi('username', 'password');
const auth = {username: 'username', password: 'password'};
const arlo = new ArloApi(auth.username, auth.password);

const devices = arlo.getDevices();
const cameras = arlo.getDevices().then(deviceArray => arlo.getCameras(deviceArray[0].deviceId, deviceArray[0].xCloudId)));
```
