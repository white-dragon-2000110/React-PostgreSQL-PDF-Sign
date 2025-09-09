# Best Open-Source Digital Signature Tools with PFX Certificate Support on Ubuntu

## Table of Contents
1. [Overview](#overview)
2. [LibreSign - Free Digital Signature Platform](#libresign---free-digital-signature-platform)
3. [DSS (Digital Signature Service)](#dss-digital-signature-service)
4. [Additional Open-Source Tools](#additional-open-source-tools)
5. [PFX Certificate Handling](#pfx-certificate-handling)
6. [Installation Comparison](#installation-comparison)
7. [Best Practices](#best-practices)

## Overview

This guide covers the best open-source digital signature tools that support PFX certificates on Ubuntu. These tools provide enterprise-grade digital signature capabilities while maintaining open-source principles and cost-effectiveness.

## LibreSign - Free Digital Signature Platform

### What is LibreSign?
LibreSign is a comprehensive, open-source digital signature platform that provides a complete solution for document signing workflows. It supports PFX certificates and offers both web-based and API-based signing capabilities.

### Key Features
- **PFX Certificate Support**: Full support for PKCS#12 (.pfx/.p12) certificates
- **Web Interface**: User-friendly web-based signing interface
- **API Integration**: RESTful API for custom integrations
- **Multi-format Support**: PDF, ODF, and other document formats
- **Workflow Management**: Advanced document workflow and approval processes
- **Audit Trail**: Complete signing history and verification logs
- **Multi-tenant**: Support for multiple organizations

### Installation Steps

#### Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required dependencies
sudo apt install -y curl wget git python3 python3-pip python3-venv
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y nginx
sudo apt install -y redis-server
sudo apt install -y nodejs npm
```

#### Step 1: Clone LibreSign Repository
```bash
# Clone the repository
git clone https://github.com/LibreSign/libresign.git
cd libresign

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
```

#### Step 2: Install Python Dependencies
```bash
# Install Python requirements
pip install -r requirements.txt

# Install additional dependencies for PFX support
pip install cryptography pyOpenSSL
pip install python-magic
pip install pillow
```

#### Step 3: Database Setup
```bash
# Create database and user
sudo -u postgres psql
```

```sql
-- In PostgreSQL prompt
CREATE DATABASE libresign;
CREATE USER libresign_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE libresign TO libresign_user;
\q
```

#### Step 4: Configuration
```bash
# Create configuration file
cp .env.example .env

# Edit configuration
nano .env
```

Add the following configuration:
```env
# Database Configuration
DATABASE_URL=postgresql://libresign_user:secure_password_here@localhost/libresign

# Application Configuration
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,your-domain.com

# PFX Certificate Configuration
PFX_CERTIFICATE_PATH=/opt/libresign/certificates
PFX_CERTIFICATE_PASSWORD=your-pfx-password

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
```

#### Step 5: Database Migration
```bash
# Run database migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

#### Step 6: Install Frontend Dependencies
```bash
# Install Node.js dependencies
npm install

# Build frontend assets
npm run build
```

#### Step 7: Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/libresign
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /path/to/libresign/staticfiles/;
    }

    location /media/ {
        alias /path/to/libresign/media/;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/libresign /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 8: Create Systemd Service
```bash
# Create systemd service file
sudo nano /etc/systemd/system/libresign.service
```

Add the following configuration:
```ini
[Unit]
Description=LibreSign Digital Signature Platform
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/libresign
Environment=PATH=/path/to/libresign/venv/bin
ExecStart=/path/to/libresign/venv/bin/python manage.py runserver 0.0.0.0:8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable libresign.service
sudo systemctl start libresign.service
```

#### Step 9: PFX Certificate Setup
```bash
# Create certificates directory
sudo mkdir -p /opt/libresign/certificates
sudo chown www-data:www-data /opt/libresign/certificates

# Copy your PFX certificate
sudo cp your-certificate.pfx /opt/libresign/certificates/
sudo chown www-data:www-data /opt/libresign/certificates/your-certificate.pfx
```

## DSS (Digital Signature Service)

### What is DSS?
DSS (Digital Signature Service) is an open-source, eIDAS-compliant digital signature service developed by the European Commission. It provides a comprehensive solution for digital signatures with strong PFX certificate support.

### Key Features
- **eIDAS Compliance**: Full compliance with European eIDAS regulation
- **PFX Support**: Native support for PKCS#12 certificates
- **Multiple Signature Formats**: PAdES, XAdES, CAdES, JAdES
- **Timestamping**: Built-in timestamping support
- **Validation**: Advanced signature validation
- **REST API**: Comprehensive REST API
- **Web Interface**: Modern web-based interface

### Installation Steps

#### Prerequisites
```bash
# Install Java 11
sudo apt install -y openjdk-11-jdk

# Install Maven
sudo apt install -y maven

# Install additional dependencies
sudo apt install -y curl wget git
```

#### Step 1: Download DSS
```bash
# Create application directory
sudo mkdir -p /opt/dss
cd /opt/dss

# Download DSS (replace with latest version)
wget https://github.com/esig/dss/releases/download/5.11/dss-5.11.zip
unzip dss-5.11.zip
```

#### Step 2: Configure Database
```bash
# Install PostgreSQL (if not already installed)
sudo apt install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql
```

```sql
-- In PostgreSQL prompt
CREATE DATABASE dss;
CREATE USER dss_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE dss TO dss_user;
\q
```

#### Step 3: Build DSS
```bash
# Navigate to DSS directory
cd dss-5.11

# Build the application
mvn clean install -DskipTests
```

#### Step 4: Configure DSS
```bash
# Create configuration directory
sudo mkdir -p /opt/dss/config

# Create application properties
sudo nano /opt/dss/config/application.properties
```

Add the following configuration:
```properties
# Database Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/dss
spring.datasource.username=dss_user
spring.datasource.password=secure_password_here
spring.datasource.driver-class-name=org.postgresql.Driver

# PFX Certificate Configuration
dss.certificate.pfx.path=/opt/dss/certificates
dss.certificate.pfx.password=your-pfx-password

# Server Configuration
server.port=8080
server.servlet.context-path=/dss

# Logging
logging.level.eu.europa.esig.dss=INFO
logging.level.org.springframework=WARN
```

#### Step 5: Create PFX Certificate Directory
```bash
# Create certificates directory
sudo mkdir -p /opt/dss/certificates
sudo chown dss:dss /opt/dss/certificates

# Copy your PFX certificate
sudo cp your-certificate.pfx /opt/dss/certificates/
sudo chown dss:dss /opt/dss/certificates/your-certificate.pfx
```

#### Step 6: Create Systemd Service
```bash
# Create dss user
sudo useradd -r -s /bin/false dss

# Create systemd service file
sudo nano /etc/systemd/system/dss.service
```

Add the following configuration:
```ini
[Unit]
Description=DSS Digital Signature Service
After=network.target postgresql.service

[Service]
Type=simple
User=dss
Group=dss
WorkingDirectory=/opt/dss/dss-5.11
ExecStart=/usr/bin/java -jar -Dspring.config.location=/opt/dss/config/application.properties dss-webapp/target/dss-webapp-5.11.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable dss.service
sudo systemctl start dss.service
```

#### Step 7: Configure Nginx (Optional)
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/dss
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name dss.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/dss /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Additional Open-Source Tools

### 1. OpenSign (Node.js-based)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Clone OpenSign
git clone https://github.com/OpenSignLabs/OpenSign.git
cd OpenSign

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Start the application
npm start
```

### 2. DocuSign Open Source Alternative
```bash
# Install Python dependencies
pip install flask flask-sqlalchemy flask-migrate
pip install cryptography pyOpenSSL
pip install reportlab PyPDF2

# Clone repository
git clone https://github.com/your-repo/docusign-alternative.git
cd docusign-alternative

# Setup database
python manage.py db init
python manage.py db migrate
python manage.py db upgrade

# Run application
python app.py
```

### 3. PDFtk with Digital Signatures
```bash
# Install PDFtk
sudo apt install -y pdftk

# Install OpenSSL for PFX handling
sudo apt install -y openssl

# Convert PFX to PEM format
openssl pkcs12 -in certificate.pfx -out certificate.pem -nodes

# Sign PDF with PDFtk
pdftk input.pdf sign output signed.pdf
```

## PFX Certificate Handling

### Converting PFX to Different Formats

#### PFX to PEM
```bash
# Extract private key and certificate
openssl pkcs12 -in certificate.pfx -out certificate.pem -nodes

# Extract only private key
openssl pkcs12 -in certificate.pfx -nocerts -out private_key.pem -nodes

# Extract only certificate
openssl pkcs12 -in certificate.pfx -clcerts -nokeys -out certificate_only.pem
```

#### PFX to P12
```bash
# Convert PFX to P12 (they are essentially the same format)
cp certificate.pfx certificate.p12
```

#### Create Self-Signed PFX Certificate
```bash
# Generate private key
openssl genrsa -out private_key.pem 2048

# Generate certificate signing request
openssl req -new -key private_key.pem -out certificate.csr

# Generate self-signed certificate
openssl x509 -req -days 365 -in certificate.csr -signkey private_key.pem -out certificate.crt

# Create PFX file
openssl pkcs12 -export -out certificate.pfx -inkey private_key.pem -in certificate.crt
```

### PFX Certificate Validation
```bash
# Validate PFX certificate
openssl pkcs12 -in certificate.pfx -noout -info

# Check certificate details
openssl x509 -in certificate.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ca_bundle.crt certificate.crt
```

## Installation Comparison

| Tool | Complexity | PFX Support | Web Interface | API | eIDAS Compliance | Best For |
|------|------------|-------------|---------------|-----|------------------|----------|
| LibreSign | Medium | ✅ Excellent | ✅ Modern | ✅ RESTful | ❌ No | General purpose, workflow management |
| DSS | High | ✅ Excellent | ✅ Professional | ✅ Comprehensive | ✅ Full | Enterprise, compliance requirements |
| OpenSign | Low | ✅ Good | ✅ Simple | ✅ Basic | ❌ No | Quick setup, small teams |
| PDFtk | Low | ✅ Basic | ❌ No | ❌ No | ❌ No | Command-line, batch processing |

## Best Practices

### Security Considerations
1. **Certificate Storage**: Store PFX certificates in secure, encrypted locations
2. **Access Control**: Implement proper user authentication and authorization
3. **Audit Logging**: Enable comprehensive audit trails for all signing activities
4. **Network Security**: Use HTTPS/TLS for all communications
5. **Regular Updates**: Keep all components updated with security patches

### Performance Optimization
1. **Database Tuning**: Optimize PostgreSQL configuration for your workload
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Load Balancing**: Use Nginx for load balancing in high-traffic scenarios
4. **Resource Monitoring**: Monitor CPU, memory, and disk usage

### Backup and Recovery
1. **Database Backups**: Implement automated database backups
2. **Certificate Backups**: Securely backup PFX certificates
3. **Configuration Backups**: Backup application configurations
4. **Disaster Recovery**: Test recovery procedures regularly

### Compliance and Legal
1. **Data Retention**: Implement proper data retention policies
2. **Privacy**: Ensure GDPR/privacy compliance
3. **Legal Validity**: Verify legal validity in your jurisdiction
4. **Documentation**: Maintain comprehensive documentation

## Troubleshooting

### Common Issues

#### LibreSign Issues
```bash
# Check service status
sudo systemctl status libresign.service

# View logs
sudo journalctl -u libresign.service -f

# Check database connection
sudo -u postgres psql -c "SELECT 1;"
```

#### DSS Issues
```bash
# Check Java version
java -version

# Check service status
sudo systemctl status dss.service

# View logs
sudo journalctl -u dss.service -f
```

#### PFX Certificate Issues
```bash
# Test PFX certificate
openssl pkcs12 -in certificate.pfx -noout -info

# Check certificate validity
openssl x509 -in certificate.crt -dates -noout

# Verify private key
openssl rsa -in private_key.pem -check -noout
```

This comprehensive guide provides you with the best open-source digital signature tools that support PFX certificates on Ubuntu, along with detailed installation instructions and best practices for each solution.