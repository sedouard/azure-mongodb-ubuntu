
waz-mongodb
=======

[![Join the chat at https://gitter.im/sedouard/azure-mongodb-ubuntu](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sedouard/azure-mongodb-ubuntu?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

An unofficial set of Bash scripts to build out a simple MongoDB replica set, designed for Microsoft Azure Linux compute VMs.

Created originally for [this blog post by Jeff Wilcox](http://www.jeff.wilcox.name/2013/09/mongodb-azure-linux/).

This is a fork that specifically works for Ubuntu instances

## Supported versions

This script currently is designed to deploy MongoDB 2l.6 replica sets on a cluster of Ubuntu 14.04 VMs

Also, it's been tested to work properly on VMs based on the following image:

`b39f27a8b8c64d52b05eac6a62ebad85__Ubuntu-14_04_1-LTS-amd64-server-20150123-en-us-30GB`

However by the time you're reading this you may want to pick an more updated image.

If you want to try newer images, run `$ azure vm image list --json | grep 14_04` and select the newest available.

Now, [that original post](http://www.jeff.wilcox.name/2013/09/mongodb-azure-linux/) is sort of outdated and highly interactive, so it ends up being error-prone. So if you want this to go faster, you may automate the whole infrastrucure creation by running:

```
node createMongoCluster.js
```

This script will generate an affinity group, virtual network, cloud service and virtual machines all connected together. It'll then insert a specialized script into each VM to initialize mongodb and join each machine to the cluster.

You can change the settings in the [clusterConfig.json](./clusterConfig.json) file:

```json
{
	"_comment": "Configuration for a mongodb cluster. Modify as necessary. VM Count should always be odd as 1 extrasmall arbiter VM will be created in addition to the number provided",
	"vm_name_prefix": "mongobase",
	"vm_size":"Medium",
	"affinity_group_name": "mongoaffinity",
	"location" : "West US",
	"vm_count": 3,
	"subnet_name": "VMs",
	"vm_username": "sedouard",
	"vm_image_name": "b39f27a8b8c64d52b05eac6a62ebad85__Ubuntu-14_04_1-LTS-amd64-server-20150123-en-us-30GB",
	"ssh_cert_path": "/Users/user/Documents/deis/contrib/azure/mycert.pem",
	"cloud_service_name": "mongosedouard",
	"storage_account_name": "mongosedouardstorage",
	"storage_account_type": "LRS",
	"vnet_name": "mongovnet",
	"availability_set_name": "mongoavailability",
	"data_disk_size": 60
}
```

(Notes: `availabilty_set_name` cannot have spaces in it and type the desired storage account type (LRS,ZRS,GRS,RAGRS or PLRS) in `storage_account_type`

# Automated cluster generation

**NOTE**: this has only been tested to work in an OS/X 10.10 (Yosemite) bash terminal. However because its based on node and the [azure x-plat CLI](http://npmjs.org/packages/azure-cli) it should work on any platform node.js is supported.

On the cloud side you must use an Ubuntu image and automation has been tested on Ubuntu 14.04 LTS.

## Required software

You will need `nodejs` and `npm`, so you can get the `azure` CLI. You will also need `openssl` for generating some keys.

```bash
npm install azure-cli -g

brew install openssl
```

You'll also need t install the necessary dependencies in the package. Execute this command at the root of this repository:

```bash
npm install
```

## Getting the Azure CLI Ready


To initialize your `azure` CLI for use with your subscription execute the command:

```bash
azure account download
```

This will redirect you to your browser to authenticate to Microsoft Azure. Afterwards download your .publishsettings file and use its path as the parameter for this command which sets you up to run the scripts:

```
azure account import <path to .publishsettings file>
```

You'll need to perform some one-time manual steps before you can run the automatic script (which you may reuse later)

#### Generate and upload certificates to Azure

*Note: the scipts involved in this step were borrowed from the [deis azure configuration guide](https://github.com/deis/deis/tree/master/contrib/azure) and the [deis official azure setup documentation](http://docs.deis.io/en/latest/installing_deis/azure.html#generate-certificates). Make sure you check there aren't any sifnificant updates/changes there before running.*

1. Update cert.conf with your personal settings
2. Generate an `azure.pem` file by running `./generate-mgmt-cert.sh`
3. Generate a `.pfx` certificate from `azure.pem` and then another `.pem` (which will be used in the script):

```bash
openssl pkcs12 -export -out ~/.ssh/mongocluster.pfx -in ~/.ssh/azure-cert.pem -name "My MongoDB cluster cert"
# generates ~./mongocluster.pfx

openssl pkcs12 -in ~/.ssh/mongocluster.pfx -out ~/.ssh/mongocluster.pem -clcerts
# generates ~./mongocluster.pem which you'll end up using in the script
```

Ok, you're now good to go. Open up `clusterConfig.json` to set the names for your cluster variables as well as the path to your ssh certificate you just generated. Save and just `npm install && node createMongoCluster.js`. This will take about 10 minutes, depending on how many VMs you want your cluster to have, so be patient.

### Logging Into the Cluster


You can easily check the replica set status by doing:

```
rs0:SECONDARY> rs.status()
{
	"set" : "rs0",
	"date" : ISODate("2015-03-06T19:25:50Z"),
	"myState" : 2,
	"syncingTo" : "mongobase0:27017",
	"members" : [
		{
			"_id" : 0,
			"name" : "mongobase0:27017",
			"health" : 1,
			"state" : 1,
			"stateStr" : "PRIMARY",
			"uptime" : 2368,
			"optime" : Timestamp(1425666454, 1),
			"optimeDate" : ISODate("2015-03-06T18:27:34Z"),
			"lastHeartbeat" : ISODate("2015-03-06T19:25:49Z"),
			"lastHeartbeatRecv" : ISODate("2015-03-06T19:25:50Z"),
			"pingMs" : 1,
			"electionTime" : Timestamp(1425666162, 1),
			"electionDate" : ISODate("2015-03-06T18:22:42Z")
		},
		{
			"_id" : 1,
			"name" : "mongobase1:27017",
			"health" : 1,
			"state" : 2,
			"stateStr" : "SECONDARY",
			"uptime" : 2376,
			"optime" : Timestamp(1425666454, 1),
			"optimeDate" : ISODate("2015-03-06T18:27:34Z"),
			"self" : true
		},
		{
			"_id" : 2,
			"name" : "mongobase2:27017",
			"health" : 1,
			"state" : 2,
			"stateStr" : "SECONDARY",
			"uptime" : 2366,
			"optime" : Timestamp(1425666454, 1),
			"optimeDate" : ISODate("2015-03-06T18:27:34Z"),
			"lastHeartbeat" : ISODate("2015-03-06T19:25:48Z"),
			"lastHeartbeatRecv" : ISODate("2015-03-06T19:25:48Z"),
			"pingMs" : 0,
			"syncingTo" : "mongobase0:27017"
		}
	],
	"ok" : 1
}
```
### YAML Mongo configuration
The configuration file for 2.6 is at `/etc/mongod.conf`, but it is now ideally a YAML-formatted file going forward. [Configuration settings documentation here](http://docs.mongodb.org/manual/reference/configuration-options/). The old format will be supported by MongoDB for some time, but this script now writes the newer YAML format.

## Did Something Go Wrong?

Oh Noes! If something with your deployment went wrong, you can diagnose the issue by grabbing a few pieces of info.

If there is an issue on your client (i.e.: the machine you're running `node createMongoCluster.js` from ) check the azure.err log specified in the error.

If the error is in one of the instances spun up by azure SSH into the box you're interested in and check some interesting logs:

The cloud-init output log (which is what is used to deploy your cluster) can be found here:
```
cat /var/log/cloud-init-output.log
```

The mongodb log can be found here:
```
cat /var/log/mongodb/mongod.log
```

Finally the scripts outputs some log output to files within `tmp`

```
ls /tmp
fdisk.log   joinCluster.js   mongodb-27017.sock  node_modules       npm-2107-414d6758  updown.js
format.log  joinCluster.log  nodeInstall.log     npm-2097-K5zMnRfu  updownInstall.log
```

Feel free to open up an issue if none of these things give you a good enough clue of what's going on.

# License
Apache License 2.0
