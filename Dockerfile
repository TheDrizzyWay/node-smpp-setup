
FROM node:8-wheezy

#INSTALL LIBAIO1 & UNZIP (NEEDED FOR STRONG-ORACLE)
RUN apt-get update \
 && apt-get install -y libaio1 \
 && apt-get install -y build-essential \
 && apt-get install -y unzip \
 && apt-get install -y curl

#ADD ORACLE INSTANT CLIENT
RUN mkdir -p opt/oracle
ADD ./oracle/linux/ .

RUN unzip instantclient-basic-linux.x64-12.2.0.1.0.zip -d /opt/oracle \
 && unzip instantclient-sdk-linux.x64-12.2.0.1.0.zip -d /opt/oracle  \
 && mv /opt/oracle/instantclient_12_2 /opt/oracle/instantclient \
 && ln -s /opt/oracle/instantclient/libclntsh.so.12.2 /opt/oracle/instantclient/libclntsh.so \
 && ln -s /opt/oracle/instantclient/libocci.so.12.2 /opt/oracle/instantclient/libocci.so

ENV LD_LIBRARY_PATH="/opt/oracle/instantclient"
ENV OCI_HOME="/opt/oracle/instantclient"
ENV OCI_LIB_DIR="/opt/oracle/instantclient"
ENV OCI_INCLUDE_DIR="/opt/oracle/instantclient/sdk/include"
ENV OCI_VERSION=12
ENV TNS_ADMIN="/opt/oracle/instantclient/network/admin"
RUN mkdir -p /opt/oracle/instantclient/network/admin


RUN export PATH=/opt/oracle/instantclient/network/admin:$PATH

ADD tnsnames.ORA /opt/oracle/instantclient/network/admin/tnsnames.ORA
ADD sqlnet.ora /opt/oracle/instantclient/network/admin/sqlnet.ora



RUN echo '/opt/oracle/instantclient/' | tee -a /etc/ld.so.conf.d/oracle_instant_client.conf && ldconfig



RUN mkdir -p /production

WORKDIR /production

ADD package.json /production/package.json

ADD . /production

# RUN ping 10.160.151.10

RUN npm install




EXPOSE 8080

CMD [ "npm", "start" ]