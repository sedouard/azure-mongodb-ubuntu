var scripty = require('azure-scripty');
var nconf = require('nconf');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var uuid = require('node-uuid');

// fetch our settings
nconf.file({ file: 'clusterConfig.json' });

createAffinityGroupIfNotExists(function(err, result){

	if(err){
		return console.error(err);
	}
	createStorageAccountIfNotExists(function(err, result){
		if(err){
			return console.error(err);
		}

		createVNetIfNotExists(function(err, result){

			if(err){
				return console.error(err);
			}

			createVirtualMachines(nconf.get('vm_count') ,function(err, result){

				if(err){
					return console.error(err);
				}
				else{
					return console.log(result);
				}
			});

		});
	})

});

function attachDataDisks(vmName, diskSize, callback){
	console.log('Attaching disk to VM %s', vmName);

	var cmd = {
		command: 'vm disk attach-new',
		positional: [vmName, diskSize, 'https://' + nconf.get('storage_account_name') + '.blob.core.windows.net/vhds/' + vmName + 'data.vhd']
	}
	scripty.invoke(cmd, function(err,data){
		if(err){
			return callback(err);
		}

		return callback();
	})
}

function createVirtualMachines(count, cb){

	console.log('Creating %s VMs (make sure it\'s an odd number!)', count);

	scripty.invoke('vm list', function (err, result) {

		if (err) {
			return cb(err);
		}

		var baseName = nconf.get('vm_name_prefix');

		var vmNames = [];

		//create the array of the computed VM names
		for (var z = 0; z < count; z++) {
			vmNames.push(baseName + z.toString());
		}

		//go through the list of existing vms
		for (var i in result) {

			for (var k in vmNames) {

				if (result[i].VMName === vmNames[k]) {
					//A VM we intend on creating already exists on this sub.
					//remove it on the list of VMs to create
					delete vmNames[k];
				}
			}
		}

		//vmNames now only contains the name of VMs that do not exist
		//create them

		var domainName = nconf.get('cloud_service_name');
		var userName = nconf.get('vm_username');

		var imageName = nconf.get('vm_image_name');
		var vmCreationTasks = [];
		var taskArguments = [];
		var primaryPasscode = uuid.v4();
		console.log("DEBUG!!!");
		console.dir(vmNames);
		for (var m in vmNames) {

			if (vmNames[m]) {
				var cmd = {
					command: 'vm create',
					positional: [nconf.get('cloud_service_name'), imageName],
					'vm-name': vmNames[m],
					'custom-data': 'setupMongoNode-' + vmNames[m] + '.sh',
					'userName': nconf.get('vm_username'),
					'ssh' : (22000 + parseInt(m)).toString(),
					'virtual-network-name': nconf.get('vnet_name'),
					'affinity-group': nconf.get('affinity_group_name'),
					'virtual-network-name': nconf.get('vnet_name'),
					'no-ssh-password': true,
					'availability-set': nconf.get('availability_set_name'),
					'ssh-cert': nconf.get('ssh_cert_path'),
					'vm-size': nconf.get('vm_size'),
					'blob-url': 'https://' + nconf.get('storage_account_name') + '.blob.core.windows.net/vhds/' + nconf.get('vm_name_prefix') + '-' + m + '.vhd'
				}

				//add connect parameter to say that we are connecting to an existing cloud service
				if(m > 0){
					cmd.connect = true;
				}


				console.dir(cmd);
				var task = function (args, callback) {
					//generate custom-data script
					fs.readFile('setupMongoNode-NonInteractive.sh', {encoding:'utf8'}, function(err,data){
						scripty.invoke('storage account keys list ' + nconf.get('storage_account_name'),
							function(err,keys){
							if(err){
								return cb(err);
							}

							var newContent = "";
							var lines = data.split('\n');
							for(var i in lines){
								newContent += lines[i] + '\n';
								if(lines[i].indexOf('NODE-GEN VARIABLES') > 0){
									if(args[0] == 0){
										newContent += 'export isPrimary=true \n';
										newContent += 'export primaryHostname=$(hostname) \n';
									}
									else{
										newContent += 'export isPrimary=false \n';
										newContent += 'export primaryHostname=' + vmNames[0] + '\n';
									}
									newContent += 'export primaryPasscode='+ args[2] + '\n';
									newContent += 'export storageAccount=' + nconf.get('storage_account_name') + '\n';
									newContent += 'export storageKey=' + keys.primaryKey;

								}


							}
							fs.writeFile('setupMongoNode-' + vmNames[args[0]] + '.sh', newContent, function(err,data){
								if(err){
									return callback(err);
								}

								console.log('Creating vm ' + vmNames[args[0]]);
								if(err){
									return callback(err);
								}
								scripty.invoke(args[1], function (err) {

									if (err) {
										return callback(err);
									}

									console.log('vm creation of ' + vmNames[args[0]] + ' successful');

									attachDataDisks(vmNames[args[0]], nconf.get('data_disk_size'), function(err, data){

										if(err){
											console.log('Failed to create disk');
											return callback(err);
										}
										console.log('sucessfully attached disk');
										return callback();
									});


								});
							});
						});
					});
				}

				task = task.bind(this, [m, cmd, primaryPasscode]);
				vmCreationTasks.push(task);
			}

		}

		async.series(vmCreationTasks, function (err) {

			if (err) {

				return cb(err);

			}

			console.log('All VMs created successfully!');
			return cb();
		});

	});

}

function createVNetIfNotExists(callback){
	console.log('Setting up virtual network...');

	scripty.invoke({
		command: "network vnet list",
	},
	function(err, vnets){

		var exists = false;

		for(var i in vnets){
			if(vnets[i].name === nconf.get('vnet_name')){
				exists = true;
				break;
			}
		}

		if(!exists){
			var cmd = {
				command: "network vnet create",
				positional:[nconf.get('vnet_name')],
				"subnet-name": nconf.get('vnet_name'),
				"affinity-group": nconf.get('affinity_group_name'),
			}
			scripty.invoke(cmd, function(err,result){

				if(err){
					return callback(err);
				}

				return callback(null);
			});

		}
		else{
			console.log('Debug3');
			process.nextTick(function(){
				console.log('vnet ' + nconf.get('vnet_name') + ' already exists');
				return callback(null);
			});
		}



	});

}

function createStorageAccountIfNotExists(callback){
	console.log('Setting up storage account...');

	scripty.invoke({
		command: "storage account list",
	},
	function(err, accounts){

		if(err){
			return callback(err);
		}

		var exists = false;
		for(var i in accounts){
			if(accounts[i].name === nconf.get('storage_account_name')){
				exists = true;
				break;
			}
		}

		if(!exists){
			var cmd = {
				command: "storage account create",
				positional:[nconf.get('storage_account_name')],
				'affinity-group': nconf.get('affinity_group_name'),
				description: "MongoDB Cluster Storage Account"
			}
			scripty.invoke(cmd, function(err,result){
				if(err){
					return callback(err);
				}

				return callback(err, result);
			});
		}
		else{
			process.nextTick(function(){
				console.log('storage account ' + nconf.get('storage_account_name') + ' already exists');
				return callback(null);
			});
		}

	});
}

function createAffinityGroupIfNotExists(callback){
	console.log('Setting up affinity group...');

	scripty.invoke({
		command: "account affinity-group list"
	},
	function(err, groups){
		if(err){
			return callback(err);
		}

		var exists = false;
		for(var i in groups){
			if(groups[i].name === nconf.get('affinity_group_name')){
				exists = true;
				break;
			}
		}

		if(!exists){
			var cmd = {
			command: "account affinity-group",
			positional:["create", nconf.get('affinity_group_name')],
			location: "\"" + nconf.get('location') + "\"",
			description: "MongoDB cluster affinity group"
			}
			scripty.invoke(cmd, function(err,result){
				if(err){
					return callback(err);
				}

				return callback(err, result);
			});
		}
		else{
			//keep both branches with the same asynchronousness.
			process.nextTick(function(){
				console.log('affinity group ' + nconf.get('affinity_group_name') + ' already exists');
				return callback(null);
			});
		}
	});
}

