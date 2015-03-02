image="b39f27a8b8c64d52b05eac6a62ebad85__Ubuntu-14_04_1-LTS-amd64-server-20150123-en-us-30GB"
userName="mongouser"
certPath="~/.ssh/mongocluster.pem"
affinityGroupLocation="East US"
affinityGroup="mongoag"
availabilitySet="MongoDB"
storage="mongoclusterstorage"
vnet="mongoclustervnet"
subnet="VMs"
nodeNameBase="mongodbcluster"
vhdNameBase="mongodbcluster"



# Create an affinity group
azure account affinity-group create -l \"$affinityGroupLocation\" -d \"MongoDB cluster\" $affinityGroup

# Create storage account
azure storage account create --affinity-group "$affinityGroup" --description \"Disks for MongoDB cluster VMs and Mongo keys\" "$storage"

# Create a virtual network
azure network vnet create --subnet-name "$subnet" --affinity-group "$affinityGroup" "$vnet"

# Create VMs

## Create Node1
azure vm create --affinity-group "$affinityGroup" --availability-set "$availabilitySet" --blob-url http://"$storage".blob.core.windows.net/vhds/"$vhdNameBase"1.vhd --vm-size Medium --vm-name "$nodeNameBase"-1 --ssh 22001 --ssh-cert "$certPath" --no-ssh-password --virtual-network-name "$vnet" --userName "$userName" --subnet-names "$subnet" dosmongodb "$image"

## Create Node2
azure vm create --connect --affinity-group "$affinityGroup" --availability-set "$availabilitySet" --blob-url http://"$storage".blob.core.windows.net/vhds/"$vhdNameBase"2.vhd --vm-size Medium --vm-name "$nodeNameBase"-2 --ssh 22002 --ssh-cert "$certPath" --no-ssh-password --virtual-network-name "$vnet" --userName "$userName" --subnet-names "$subnet" dosmongodb "$image"

## Create Arbitrer
azure vm create --connect --affinity-group "$affinityGroup" --availability-set "$availabilitySet" --blob-url http://"$storage".blob.core.windows.net/vhds/"$vhdNameBase"arbitrer.vhd --vm-size ExtraSmall --vm-name "$nodeNameBase"-arbitrer --ssh 22003 --ssh-cert "$certPath" --no-ssh-password --virtual-network-name "$vnet" --userName "$userName" --subnet-names "$subnet" dosmongodb "$image"

# Attach data disks to data nodes
azure vm disk attach-new "$nodeNameBase"-1 60 https://"$storage".blob.core.windows.net/vhds/"$vhdNameBase"1-data.vhd
azure vm disk attach-new "$nodeNameBase"-2 60 https://"$storage".blob.core.windows.net/vhds/"$vhdNameBase"2-data.vhd

# Expose enpoints
azure vm endpoint create "$nodeNameBase"-1 27017 27017
azure vm endpoint create "$nodeNameBase"-2 27018 27017

# bash (?)
# ssh -p 22001 gvilarino@dosmongodb.cloudapp.net

# wget https://raw.githubusercontent.com/gvilarino/waz-mongodb/master/setupMongoNode.sh && chmod a+x setupMongoNode.sh && ./setupMongoNode.sh

# clusteradmin
# +OrWwBi2afAsfhgPzVJUCvwd+N1gN67xdFx2gMTGKzMqAp1wR+Q3cFOpxcKmf+7I
