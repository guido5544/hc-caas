# CaaS (Communicator as a Service): Conversion and Streaming Server Backend for HOOPS Communicator

## Overview

### Main Features
* Conversion Queue for multiple simultaneous CAD conversion jobs.
* Multiple connected conversion queue machines can all pull jobs from the same queue.
* S3 Storage option with direct S3 upload via tokens (optional).
* Local Model Caching for Streaming and SCS loading (optional).
* Support for multifile upload and ZIP upload (for assemblies) 
* Support for shattered workflows.
* Comprehensive REST API for managing the conversion queue and pulling data.
* Support for FBX and GLB output formats via HOOPS Exchange.
* Support for direct SCS upload and image generation from SCS files.
* Access to all converter command-line options for conversion.
* Run via NPX directly or embed into your application as a node module.
* Support for SCS and SC Streaming

### Limitations
* **This library is not an officially supported part of HOOPS Communicator and provided as-is.**
* No account/user management or security. This is BY DESIGN. CaaS is meant to be accessed behind a firewall from the server-side business logic of your application. A reference application that CaaS in that manner is provided.
* Only tested on windows

### ToDo

* Linux Testing
* Support for Azure Blob Storage
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
      "queue": {
        "converterpath": "PATH_TO_COMMUNICATOR_DIRECTORY/authoring/converter/bin/win64",
      }   
    }
  }  
```
2. Create empty working directory specified above (make sure to provide absolute path!)
3. Ensure mongoDB is running on localhost:27017
4. Run CaaS with the following command: **npx ts3d-hc-conversionserver**. It is now accessible on port 3001
5. Run the Basic Demo below on the same machine CaaS is running on.

## Demos

A simple demo application that uses the API directly and which can be used for testing CaaS locally and exploring the REST API usage can be found here: [Basic Demo Github Link](https://github.com/techsoft3d/conversionserver_basic_example)

A more comprehensive demo that aims to demonstrate a more realistic use-case, includes user and project management and accesses CaaS server-side can be found here: [Advanced Demo Github Link](https://github.com/techsoft3d/conversionserver-demo-app)

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
    "useS3": false,    
    "license": "",
    "fullErrorReporting": false,
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
        "s3": {
          "region": "us-west-2",
          "bucket": "mybucket"
        },
        "filesystem": {
          "directory": ""
        }
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

3. CaaS requires a running mongoDB session. If you are planning to run multiple connected CaaS instances, you need to provide a common database session to all instances. We recommend MongoDB Atlas for that purpose. For more information see the links below.  After the database is running you need to provide the connection string in the mongodbURI field. For security reasons it is recommended that you omit the username and password (if any) and instead provide those in the environment variables "DB_USERNAME" and "DB_PASSWORD".

    [MongoDB Local Install] (https://www.mongodb.com/try/download/community)  
    [MongoDB Atlas] (https://www.mongodb.com/atlas/database)

4. Create a folder for temporary data and provide the path in the workingDirectory field.
5. Specify desired port. CaaS is meant to run **behind** a firewall and should not be accessible from the web directly but you need to still ensure that the port is accessible if CaaS runs on a different machine from the main application. 
6. Set runQueue to true if you want to run the conversion queue on this machine. As long as the machines running the conversion queue are sharing the same database session, and storage you can run an unlimited number of instances in parallel.
7. Set runServer to true if you want to run the CaaS Rest API frontend on this machine. The frontend provides the REST API endpoints for the conversion queue and streaming servers. It is possible to have multiple active frontends, all connected to the same storage and database. This could be a desirable configuration in a multi-region setup.  
8. If you enabled the conversion queue (runQueue:true) you need to provide the path to the directory containing the converter executable of the HOOPS Communicator package/installation. You also need to provide a valid license for HOOPS Communicator.
9. If the conversion queue is running on a different machine from the server you need to specify the accessible ip address of the queue here. If the ip field is left blank the conversion queue will automatically query the IP address of the machine it is currently running on. This is useful when the queue is started via a scaling server like AWS beanstock.
10. By default CaaS will assign conversion jobs to all registered conversion queue servers based on their available capacity. If polling is set to true the conversion queue will poll for a newly available job every few seconds. In this case a conversion queue server does not need to be registered with the main server.
11. If you are uploading SCS or SCZ files, CAAS will use a separate module in order to generate PNG's for those file types. See [here](https://www.npmjs.com/package/ts3d-hc-imageservice) for more information. You can specify the port this module uses for its internal server here.
12. If you are running CaaS as a node module and use the API directly you can optionally turn off the REST API endpoints. In this case your code needs to handle file uploads and other actions.
13. If you are planning to use S3 for storaging the converted models you need to set the useS3 field to true and provide a valid AWS region and S3 bucket name. You also need to make sure AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID is set, either via environment variables or throug a config file. (see [AWS Credentials](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)). If you are using a network of multiple conversion queue instances, you need to specify the same bucket/region for all of them. If you are not using S3, the system will fall back to storing the conversion data locally in the directory provided by workingDirectory.
14. If you are planning to support SCZ model streaming, you need to provide at a minimum the path to ts3d_sc_server.exe. Each parallel streaming instance will run on separate consecutive ports, the range specified by startPort and maxStreamingSession, which are proxied from listenPort.
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

## Node Module API Reference
(todo)

## REST API Reference


### **/api/upload**

#### **Description**
Uploads a new CAD file and places it on the conversion queue.

#### **Example**
```
let form = new FormData();
form.append('file', fs.createReadStream("myfile.stp"));
let res = await fetch(conversionServerURI + '/api/upload', { method: 'POST', body: form,headers: {'CS-API-Arg': JSON.stringify({webhook:"http://localhost:3000/api/webhook"})}});
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
let res = await fetch(conversionServerURI + '/api/data/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
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
let res = await fetch(conversionServerURI + '/api/file/c79dd99e-cbbd-4b6d-ba43-15986b1adc14/scs');
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
let res = await fetch(conversionServerURI + '/api/original/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
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
let res = await fetch(conversionServerURI + '/api/reconvert/c79dd99e-cbbd-4b6d-ba43-15986b1adc1', { method: 'put', headers: {'CS-API-Arg': JSON.stringify({conversionCommandLine:["--output_step",""] })}});

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
 let res = await fetch(conversionServerURI + '/api/delete/c79dd99e-cbbd-4b6d-ba43-15986b1adc1', { method: 'put'});
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
let res = await fetch(conversionServerURI + '/api/items');
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
let res = await fetch(conversionServerURI + '/api/items');
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
let res = await fetch(conversionServerURI + '/api/uploadToken', {headers: {'CS-API-Arg': JSON.stringify({webhook:"http://localhost:3000/api/webhook"})}});

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
  let res = await fetch(conversionServerURI + '/api/downloadToken/c79dd99e-cbbd-4b6d-ba43-15986b1adc1/scs');     
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
let res = await fetch(conversionServerURI + '/api/shattered/c79dd99e-cbbd-4b6d-ba43-15986b1adc14/part.scs');
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
let res = await fetch(conversionServerURI + '/api/shatteredXML/c79dd99e-cbbd-4b6d-ba43-15986b1adc14');
let shatteredData = await res.text();
...
```

#### **Parameters**
*As specified in URL string:*

* ID of the item for which to retrieve the shattered part for.  
 

#### **Returns**
XML data