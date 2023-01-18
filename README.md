# CaaS (Communicator as a Service): Conversion and Streaming Server Backend for HOOPS Communicator

## Overview

### Main Features
* Conversion Queue for distributed CAD conversions.
* SC Streaming or SCS Loading
* S3 Storage option with direct S3 upload via tokens.
* Local Model Caching for Streaming and SCS loading.
* Region Replication for S3 storage
* Support for multifile upload and ZIP upload (for assemblies) 
* Support for shattered workflows.
* Comprehensive REST API.
* Support for FBX and GLB output formats via HOOPS Exchange.
* Support for direct SCS upload and image generation from SCS files.
* Access to all converter command-line options for conversion.
* Run via NPX directly or embed into your Node.js application as a module.

### Limitations
* **This library is not an officially supported part of HOOPS Communicator and provided as-is.**
* No account/user management or security. This is BY DESIGN. CaaS is meant to be accessed behind a firewall from the server-side business logic of your application. A reference application that uses CaaS in that manner is provided.
* Only tested on windows

### ToDo

* Linux Testing
* Support for Azure Blob Storage
* Module JS API documentation
* Plugin Support to allow for User Defined Storage Options

## Quick Start
To quickly test out CaaS with a simple front-end and scs loading, follow the steps below.

1. Ensure that HOOPS Communicator is installed on your machine. (You can get a 60 day trial license here: https://www.techsoft3d.com/products/hoops/web-platform/)
2. Create a new directory and create folder called "config" with empty local.json file. Copy content below and add your HOOPS Communicator license, path to a temp directory and path to HOOPS Converter
```json
{
    "hc-caas": {      
      "workingDirectory": "PATH_TO_TEMP_DIRECTORY",
      "license": "HOOPS_COMMUNICATOR_LICENSE_KEY",
      "runStreamingManager": false,
      "runStreamingServer": false,
      "queue": {
        "converterpath": "PATH_TO_COMMUNICATOR_DIRECTORY/authoring/converter/bin/win64",
      }   
    }
  }  
```
2. Create empty working directory specified above (make sure to provide absolute path!)
3. Ensure mongoDB is running on localhost:27017
4. Run CaaS with the following command: **npx ts3d.hc.caas**. It is now accessible on port 3001
5. Run the Basic Demo below on the same machine CaaS is running on.

## Demos

A simple demo application that uses the API directly and which can be used for testing CaaS locally and exploring the REST API usage can be found here: [Basic Demo Github Link](https://github.com/techsoft3d/caas_basic_example)

A more comprehensive demo that aims to demonstrate a more realistic use-case, includes user and project management and accesses CaaS server-side can be found here: [Advanced Demo Github Link](https://github.com/techsoft3d/caas-demo-app)

## Install & Run Using GitHub
1. Clone [GitHub Project](https://github.com/techsoft3d/hc-caas) 
2. Create a local.json file in config directory. This file will contain any local configuration overrides. See the defaults below or in config/default.json. 

```json
{
  "hc-caas": {
    "mongodbURI": "mongodb://localhost:27017/conversions",
    "workingDirectory": "E:/temp/conversionservicetemp",
    "port": "3001",
    "runQueue": true,
    "runServer": true,
    "runStreamingManager": true,
    "runStreamingServer": true,
    "storageBackend": "filesystem",
    "license": "",
    "fullErrorReporting": false,
    "region": "",
    "queue": {
      "converterpath": "E:/communicator/HOOPS_Communicator_2022_SP2/authoring/converter/bin/win64",
      "HEimportexportpath": "E:/GitHub/conversionservice/HE/ImportExport/x64/Release",
      "HEInstallPath": "E:/communicator/HOOPS_Exchange_Publish_2022_SP2/bin/win64_v140",
      "maxConversions": 4,
      "ip": "localhost",
      "polling": false,
      "imageServicePort": "3002"
    },
    "server": {
      "listen": true
    },
    "streamingServer": {
      "scserverpath": "E:/communicator/HOOPS_Communicator_2022_SP2/server/bin/win64",
      "maxStreamingSessions" : 10,
      "useSymLink": false,
      "ip": "localhost",
      "startPort": 3006,
      "listenPort":3200,
      "publicAddress": "",
      "publicPort": ""     
    },      
    "storage": {
      "destination": "",
      "copyDestinations": [],
      "replicate": false,
      "externalReplicate": false
    },
    "localCache": {
      "directory": "",
      "maxSize": 0
    },
    "proxy": {
      "keyPath": "",
      "certPath": ""
    }
  }
}
```

3. CaaS requires a running mongoDB session. If you are planning to run multiple connected CaaS instances, you need to provide a common database session to all connected instances. We recommend MongoDB Atlas for that purpose but you can of course run your own database server. For more information see the links below. After the database is running you need to provide the connection string in the mongodbURI field. For security reasons it is recommended that you omit the username and password (if any) and instead provide those in the environment variables "DB_USERNAME" and "DB_PASSWORD".

    [MongoDB Local Install] (https://www.mongodb.com/try/download/community)  
    [MongoDB Atlas] (https://www.mongodb.com/atlas/database)

4. Create a folder for temporary data and provide the path in the workingDirectory field.
5. Specify desired port. CaaS is meant to run **behind** a firewall and should not be accessible from the web directly but you need to still ensure that the port is accessible if CaaS runs on a different machine from the main application. 
6. Set runQueue to true if you want to run the conversion queue on this machine. As long as the machines running the conversion queue are sharing the same database session, and storage you can run an unlimited number of instances in parallel.
7. Set runServer to true if you want to run the CaaS Rest API frontend on this machine. The frontend provides the REST API endpoints for the conversion queue and streaming servers. It is possible to have multiple active frontends, all connected to the same storage and database. This could be a desirable configuration in a multi-region setup.  
8. If you enabled the conversion queue (runQueue:true) you need to provide the path to the directory containing the converter executable of the HOOPS Communicator package/installation. You also need to provide a valid license for HOOPS Communicator.
9. If the conversion queue is running on a different machine from the server you need to specify the ip address and port of the queue here that is accessible from the server.
10. By default CaaS will assign conversion jobs to all registered conversion queue servers based on their available capacity. If polling is set to true the conversion queue will poll for a newly available job every few seconds. In this case a conversion queue server does not need to be registered with the main server.
11. If you are uploading SCS or SCZ files, CAAS will use a separate module in order to generate PNG's for those file types. See [here](https://www.npmjs.com/package/ts3d-hc-imageservice) for more information. You can specify the port this module uses for its internal server here.
12. If you are running CaaS as a node module and use the API directly you can optionally turn off all REST API endpoints. In this case your code needs to handle file uploads and other actions.
13. If you are planning to use S3 for storaging the converted models you need to set the "storageBackend" field to "s3" and provide a valid AWS S3 bucket name in the "storage.destination" field. You also need to make sure AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID is set, either via environment variables or through a config file. (see [AWS Credentials](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)). If you are using a network of multiple conversion queue instances, you need to specify a bucket that is accessible to all instances. If you are not using S3, the system will fall back to storing the conversion data locally in the directory provided by workingDirectory.
14. If you are planning to support SCZ model streaming, you need to provide the path to ts3d_sc_server.exe. Each parallel streaming session on the same machine will run on separate consecutive ports, the range specified by startPort and maxStreamingSession, which are proxied from listenPort.
15. Run CaaS via npm start

## Install & Run Using NPX

1. Create empty directory and navigate to it
2. Create config directory
3. Follow Steps 2 - 14 from above.
4. Run the application with the following command:

```
npx ts3d.hc.caas
```


## Install & Run as a node module.

1. Navigate to your project directory
2. Install the node module with the following command:

```
npm install ts3d.hc.caas
```

3. Follow steps 2 - 14 from above.

4. In the startup module of your application, add the following code to initialize the conversion server:

```
const conversionserver = require('ts3d.hc.caas');
conversionserver.start();
```

## Scaling
While it is easy to setup CaaS to run on a single machine, it is often desirable to scale the system to multiple machines, in particular for CAD conversions. This can be done by running multiple instances of CaaS on different machines. Each instance can be configured to run the conversion queue, the streaming server or both. As long as all instances are connected to the same database and storage, they will be able to share the load.

[todo: add diagram, configuration examples]

## Multi-Region Support
To improve performance, it might be desirable to deploy multiple instances of CaaS in different regions. There are a few things to consider when doing this:

*  If you specify a "hc-caas.region", only conversion queues that have the same region tags will be used for conversion. In addition, only streaming servers with that same region tag will be used for viewing. All uploaded and converted models however, will still be stored in the same location. (see next point)
* With "hc-caas.storage.destination" you can specify the location where converted models will be stored, which corresponds to a bucket in S3 or a local or network path (for filesystem). For multiple regions, you can specify different destinations, which ideally should corrspond to a storage location with fast access in your region. 
* If a model  that has been converted with a particular destination is requested from a CaaS instance that has a different destination, performance might be affected, though it should still be accessible. However, if "hc-caas.storage.replicate" is set to true, the model will be copied to the requested destination and the copy will be used for the next request. This will improve performance, but will also increase storage costs.
* In "hc-caas.storage copyDestinations" you can optionally specifiy an array of "destinations". After a model is converted, it will automatically be replicated to those destinations.
* If you have setup automatic replication via S3 specific functionality outside of CaaS, you should set "hc-caas.storage.externalReplicate" to true. In this case, CaaS will always attempt to access the model from the local destination, and fallback to the original destination if it is not found. 
* Multi-Region Supported is currently only available for S3 storage.

## Caching
If "hc-caas.cache.maxSize" is > 0, CaaS will cache a model when it is first accessed. This value is in MB and represents the maximum allowed model cache on disk. You can also specify the directory for the cache, otherwise it will be inside the workingDirectory folder. Caching can greatly improve performance, in particular for large SCZ or SCS files.

## Proxy Considerations when Streaming
It might be desirable to run the streaming service via a proxy, so that all requested are processed via port 80 or 443. An example of such a setup can be found in proxy.js.  
[todo: more details]


## Presigned URL Upload Flow for S3
[todo]

## Node Module API Reference
[todo]


## REST API Reference


### **/api/upload**

#### **Description**
Uploads a new CAD file and places it on the conversion queue.

#### **Example**
```
let form = new FormData();
form.append('file', fs.createReadStream("myfile.stp"));
let res = await fetch(caasURI + '/api/upload', { method: 'POST', body: form,headers: {'CS-API-Arg': JSON.stringify({webhook:"http://localhost:3000/api/webhook"})}});
let data = await res.json();
```

#### **Parameters**
*CS-API-Arg:*
```
{
  webhook: "http://localhost:3000/api/webhook",
  startPath: "micro_engine/_micro engine.CATProduct",
  conversionCommandLine:["--output_scs","","--output_png","","background_color","0,0,0","--output_step",""],
  itemid: "c79dd99e-cbbd-4b6d-ba43-15986b1adc14",
  processShattered:false,
  skipConversion:false,
}
```
*webhook* - The ip address to call when the conversion is complete. If not provided polling is required to check the conversion status.  
*startPath* - If a zip file is uploaded this is the relative path within the zip file to the main assembly file.  
*conversionCommandLine* - The command line arguments to pass to converter. This will replace the default command line that exports scs and png files (on a white background).  
*itemid* - If an existing itemid is provided, the uploaded file will be stored alongside the original file and no conversion will be performed.  
*processShattered* - If set to true, a shattered version of the CAD assembly will be generated.  
*skipConversion* - If set to true, the uploaded file will not be converted.  

#### **Returns**
ID of newly created item
```
{"itemid":"c79dd99e-cbbd-4b6d-ba43-15986b1adc14"}
```


### **/api/data**

#### **Description**
Retrieves data about a conversion item.

#### **Example**
```
let res = await fetch(caasURI + '/api/data/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to request its data.

#### **Returns**
Information about the requested item.
```
{
  name: "landinggearmainshaftwithpmi_fullpmi.catpart",
  startPath: "",
  conversionState: "SUCCESS",
  updated: "2022-05-29T12:52:02.787Z",
  created: "2022-05-29T12:51:55.697Z",
  webhook: "http://localhost:3000/api/webhook",
  files: [
    "landinggearmainshaftwithpmi_fullpmi.catpart.png",
    "landinggearmainshaftwithpmi_fullpmi.catpart.scs",
  ],
}
```


### **/api/file**

#### **Description**
Retrieves a file from the conversion server.

#### **Example**
```
let res = await fetch(caasURI + '/api/file/c79dd99e-cbbd-4b6d-ba43-15986b1adc14/scs');
let buffer = await res.arrayBuffer();
...
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve one of its converted file types.  
* Type of file to retrieve (scs, png, etc.)

#### **Returns**
Binary Data

  
### **/api/original**

#### **Description**
Retrieves the file that was uploaded to the conversion server.

#### **Example**
```
let res = await fetch(caasURI + '/api/original/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
let buffer = await res.arrayBuffer();
...
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve its original file.  

#### **Returns**
Binary Data


  
### **/api/reconvert**

#### **Description**
Reconverts an existing conversion item.

#### **Example**
```
let res = await fetch(caasURI + '/api/reconvert/c79dd99e-cbbd-4b6d-ba43-15986b1adc1', { method: 'put', headers: {'CS-API-Arg': JSON.stringify({conversionCommandLine:["--output_step",""] })}});

...
```

#### **Parameters**
*As specified in URL string:*
* ID of the item for which to retrieve its original file.  

*CS-API-Arg:*
```
{  
  startPath: "micro_engine/_micro engine.CATProduct",
  conversionCommandLine:["--output_scs","","--output_png","","background_color","0,0,0","--output_step",""],
  processShattered: false,
}
```
*startPath* - If a zip file is uploaded this is the relative path within the zip file to the main assembly file.  
*conversionCommandLine* - The command line arguments to pass to converter. This will replace the default command line that exports scs and png files (on a white background).  
*processShattered* - If set to true, a shattered version of the CAD assembly will be generated.  

#### **Returns**
NONE


### **/api/delete**

#### **Description**
Deletes a conversion item including all converted data.

#### **Example**
```
 let res = await fetch(caasURI + '/api/delete/c79dd99e-cbbd-4b6d-ba43-15986b1adc1', { method: 'put'});
...
```

#### **Parameters**
*As specified in URL string:*
* ID of the item to delete
#### **Returns**
NONE

 
### **/api/items**

#### **Description**
Retrieves a list of all conversion items available on the conversion server.

#### **Example**
```
let res = await fetch(caasURI + '/api/items');
...
```

#### **Parameters**
NONE
#### **Returns**
JSON Array of available conversion items and all their data.



### **/api/updated**

#### **Description**
Retrieves the time any of the items on the conversion server were last updated (or deleted).

#### **Example**
```
let res = await fetch(caasURI + '/api/items');
...
```

#### **Parameters**
NONE
#### **Returns**
JSON containing last updated time
```
{lastUpdated: '2022-05-29T14:27:03.001Z'}
```



### **/api/uploadToken**

#### **Description**
Retrieves an upload token for directly uploading a file to S3 storage. After receiving the token and uploading the file directly from the client, *api/reconvert* should be called to start the conversion process.

#### **Example**
```
let res = await fetch(caasURI + '/api/uploadToken', {headers: {'CS-API-Arg': JSON.stringify({webhook:"http://localhost:3000/api/webhook"})}});

```

#### **Parameters**
*CS-API-Arg:*
```
{
  webhook: "http://localhost:3000/api/webhook" 
}
```
*webhook* - The ip address to call when the conversion is complete. If not provided polling is required to check the conversion status.  

#### **Returns**
JSON containing signed request URL and itemid
```
{ token: signedRequestURLforS3, itemid: c79dd99e-cbbd-4b6d-ba43-15986b1adc14 };
```

### **/api/downloadToken**

#### **Description**
Retrieves a download token for directly downloading a file from S3 storage. 

#### **Example**
```
  let res = await fetch(caasURI + '/api/downloadToken/c79dd99e-cbbd-4b6d-ba43-15986b1adc1/scs');     
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve the download token.  
* Type of file to retrieve the token for (scs, png, etc.)

#### **Returns**
JSON containing signed request URL

```
{ token: signedRequestURLforS3 };
```



### **/api/shattered**

#### **Description**
Retrieves a shattered part for a conversion item converted with the *processShattered* argument.

#### **Example**
```
let res = await fetch(caasURI + '/api/shattered/c79dd99e-cbbd-4b6d-ba43-15986b1adc14/part.scs');
let buffer = await res.arrayBuffer();
...
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve the shattered part for.  
* Name of the shattered scs file.  

#### **Returns**
Binary Data



### **/api/shatteredXML**

#### **Description**
Retrieves the shattered XML file for a conversion item converted with the *processShattered* argument.

#### **Example**
```
let res = await fetch(caasURI + '/api/shatteredXML/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
let shatteredData = await res.text();
...
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve the shattered part for.  
 

#### **Returns**
XML data


### **/api/streamingSession**

#### **Description**
Request a new streaming session

#### **Example**
```
let res = await fetch(caasURI + '/api/streamingSession');
let data = await res.json();
viewer = new Communicator.WebViewer({
      containerId: "viewerContainer",
      endpointUri: 'ws://' + data.serverurl + ":" + data.port + '?token=' + data.sessionid,
      model: "_empty",
      rendererType: Communicator.RendererType.Client
    });
...
```

#### **Parameters**
None
 

#### **Returns**
JSON Object 

```
{ serverurl: url of streaming server,
  port: port of streaming server,
  sessionid: session id for streaming session };
```


### **/api/enableStreamAccess**

#### **Description**
Makes an scz file available for streaming

#### **Example**
```
await fetch(caasURI + '/api/enableStreamAccess/' + sessionid, { method: 'put', headers: { 'items': JSON.stringify([modelid]) } });
...
```

#### **Parameters**
*As specified in URL string:*

* Session id of the streaming session.

*CS-API-Arg:*

*items* - Array of model ids to make available for streaming.

 
#### **Returns**
None


### **/api/version**

#### **Description**
Retrieves CaaS Version String 


#### **Parameters**
None
 
#### **Returns**
CaaS Version