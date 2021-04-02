#!/bin/bash
#dependency lib
sudo apt install libmicrohttpd-dev libjansson-dev libssl-dev libsrtp2-dev libsofia-sip-ua-dev libglib2.0-dev libopus-dev libogg-dev libcurl4-openssl-dev liblua5.3-dev libconfig-dev pkg-config gengetopt libtool automake gtk-doc-tools make cmake  -y
#libnice
git clone https://github.com/libnice/libnice.git
cd libnice
git checkout 0.1.17
./autogen.sh
 sudo make && sudo make install && sudo ldconfig
#libsrtp
cd .. && wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz && tar xfv v2.2.0.tar.gz
cd libsrtp-2.2.0
./configure --prefix=/usr --enable-openssl
make shared_library && sudo make install
cd .. && git clone https://github.com/sctplab/usrsctp
cd usrsctp
./bootstrap
./configure --prefix=/usr --disable-programs --disable-inet --disable-inet6
make && sudo make install 
#rabbitmq
# cd .. && git clone https://github.com/alanxz/rabbitmq-c
# cd rabbitmq-c
# git submodule init
# git submodule update
# mkdir build && cd build
# cmake -DCMAKE_INSTALL_PREFIX=/usr --libdir=/usr/lib64 ..
# make && sudo make install
#mqtt
git clone https://github.com/eclipse/paho.mqtt.c.git
cd paho.mqtt.c
make && sudo make install
#media-server
cd ..
git clone https://github.com/hdvt/media-server.git && cd media-server && git checkout develop
sh autogen.sh
./configure --sysconfdir=$PWD/conf
make
