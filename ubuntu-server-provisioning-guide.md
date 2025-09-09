# Ubuntu 20.04 Server Provisioning Guide for Digital Signature Application

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Pre-Installation Checklist](#pre-installation-checklist)
3. [Server Provisioning Steps](#server-provisioning-steps)
4. [Security Hardening](#security-hardening)
5. [Required Dependencies](#required-dependencies)
6. [Digital Signature Application Setup](#digital-signature-application-setup)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Backup Strategy](#backup-strategy)
9. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Hardware Specifications
- **CPU**: 2 cores, 2.0 GHz minimum
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 50 GB SSD minimum (100 GB recommended)
- **Network**: 1 Gbps connection
- **Architecture**: x86_64

### Recommended Hardware Specifications
- **CPU**: 4+ cores, 2.4 GHz or higher
- **RAM**: 16 GB or more
- **Storage**: 200+ GB NVMe SSD
- **Network**: 10 Gbps connection for high-volume operations
- **Redundancy**: RAID 1 or RAID 10 for storage

### Software Requirements
- **Operating System**: Ubuntu 20.04.6 LTS (Long Term Support)
- **Kernel**: 5.4.0 or later
- **Virtualization**: KVM, VMware, or bare metal

## Pre-Installation Checklist

### 1. Server Access Preparation
- [ ] Obtain server credentials (IP address, root/sudo access)
- [ ] Ensure SSH key pair is generated
- [ ] Verify network connectivity
- [ ] Confirm DNS resolution works
- [ ] Document server specifications

### 2. Security Preparation
- [ ] Plan firewall rules
- [ ] Prepare SSL/TLS certificates
- [ ] Plan user account structure
- [ ] Prepare backup strategy

## Server Provisioning Steps

### Step 1: Initial Server Setup

#### 1.1 Connect to Server
```bash
# Connect via SSH
ssh root@your-server-ip
# or
ssh username@your-server-ip
```

#### 1.2 Update System Packages
```bash
# Update package lists
apt update

# Upgrade all packages
apt upgrade -y

# Install essential packages
apt install -y curl wget git vim nano htop unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

#### 1.3 Set Timezone
```bash
# List available timezones
timedatectl list-timezones

# Set timezone (replace with your timezone)
timedatectl set-timezone America/New_York

# Verify timezone
timedatectl
```

#### 1.4 Configure Hostname
```bash
# Set hostname
hostnamectl set-hostname digital-signature-server

# Update /etc/hosts
echo "127.0.0.1 digital-signature-server" >> /etc/hosts
```

### Step 2: User Management

#### 2.1 Create Application User
```bash
# Create dedicated user for the application
useradd -m -s /bin/bash sigapp

# Add user to sudo group
usermod -aG sudo sigapp

# Set password for the user
passwd sigapp

# Create application directory
mkdir -p /opt/digital-signature
chown sigapp:sigapp /opt/digital-signature
```

#### 2.2 Configure SSH Access
```bash
# Create .ssh directory for the user
mkdir -p /home/sigapp/.ssh
chmod 700 /home/sigapp/.ssh

# Add your public key to authorized_keys
echo "your-public-key-here" >> /home/sigapp/.ssh/authorized_keys
chmod 600 /home/sigapp/.ssh/authorized_keys
chown -R sigapp:sigapp /home/sigapp/.ssh

# Disable root login (security best practice)
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### Step 3: Firewall Configuration

#### 3.1 Install and Configure UFW
```bash
# Install UFW
apt install -y ufw

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow ssh

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow custom application port (if needed)
# ufw allow 8080/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status verbose
```

## Security Hardening

### 1. System Hardening

#### 1.1 Disable Unnecessary Services
```bash
# List running services
systemctl list-units --type=service --state=running

# Disable unnecessary services (examples)
systemctl disable bluetooth
systemctl disable cups
systemctl disable avahi-daemon
```

#### 1.2 Configure Automatic Security Updates
```bash
# Install unattended-upgrades
apt install -y unattended-upgrades

# Configure automatic updates
dpkg-reconfigure -plow unattended-upgrades

# Edit configuration
nano /etc/apt/apt.conf.d/50unattended-upgrades
```

#### 1.3 Install and Configure Fail2ban
```bash
# Install fail2ban
apt install -y fail2ban

# Create local configuration
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
nano /etc/fail2ban/jail.local

# Start and enable fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### 2. SSL/TLS Configuration

#### 2.1 Install Certbot for Let's Encrypt
```bash
# Install snapd
apt install -y snapd

# Install certbot
snap install --classic certbot

# Create symlink
ln -s /snap/bin/certbot /usr/bin/certbot
```

#### 2.2 Generate SSL Certificate
```bash
# Generate certificate (replace with your domain)
certbot certonly --standalone -d your-domain.com

# Set up auto-renewal
crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Required Dependencies

### 1. Java Runtime Environment
```bash
# Install OpenJDK 11 (recommended for digital signature applications)
apt install -y openjdk-11-jdk

# Verify installation
java -version
javac -version

# Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64' >> /etc/environment
echo 'export PATH=$PATH:$JAVA_HOME/bin' >> /etc/environment
source /etc/environment
```

### 2. Database Setup (PostgreSQL)
```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
-- In PostgreSQL prompt
CREATE DATABASE digital_signature_db;
CREATE USER sigapp_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE digital_signature_db TO sigapp_user;
\q
```

### 3. Web Server (Nginx)
```bash
# Install Nginx
apt install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Configure firewall for Nginx
ufw allow 'Nginx Full'
```

### 4. Additional Dependencies
```bash
# Install additional packages for digital signature applications
apt install -y \
    libssl-dev \
    libffi-dev \
    python3-dev \
    python3-pip \
    nodejs \
    npm \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev
```

## Digital Signature Application Setup

### 1. Application Directory Structure
```bash
# Create application structure
mkdir -p /opt/digital-signature/{app,logs,config,certs,backups}
mkdir -p /opt/digital-signature/app/{bin,lib,web}

# Set proper permissions
chown -R sigapp:sigapp /opt/digital-signature
chmod -R 755 /opt/digital-signature
```

### 2. Environment Configuration
```bash
# Create environment file
cat > /opt/digital-signature/config/.env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=digital_signature_db
DB_USER=sigapp_user
DB_PASSWORD=secure_password_here

# Application Configuration
APP_PORT=8080
APP_ENV=production
LOG_LEVEL=INFO

# Security Configuration
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here

# SSL Configuration
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
EOF

# Secure the environment file
chmod 600 /opt/digital-signature/config/.env
chown sigapp:sigapp /opt/digital-signature/config/.env
```

### 3. Systemd Service Configuration
```bash
# Create systemd service file
cat > /etc/systemd/system/digital-signature.service << EOF
[Unit]
Description=Digital Signature Application
After=network.target postgresql.service

[Service]
Type=simple
User=sigapp
Group=sigapp
WorkingDirectory=/opt/digital-signature/app
ExecStart=/usr/bin/java -jar /opt/digital-signature/app/digital-signature.jar
Restart=always
RestartSec=10
EnvironmentFile=/opt/digital-signature/config/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/digital-signature

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable digital-signature.service
```

## Monitoring and Maintenance

### 1. System Monitoring

#### 1.1 Install Monitoring Tools
```bash
# Install monitoring packages
apt install -y htop iotop nethogs nload

# Install log monitoring
apt install -y logwatch

# Configure logwatch
nano /etc/logwatch/conf/logwatch.conf
```

#### 1.2 Set Up Log Rotation
```bash
# Configure logrotate for application logs
cat > /etc/logrotate.d/digital-signature << EOF
/opt/digital-signature/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 sigapp sigapp
    postrotate
        systemctl reload digital-signature.service
    endscript
}
EOF
```

### 2. Performance Monitoring
```bash
# Install and configure monitoring
apt install -y sysstat

# Enable sysstat
systemctl enable sysstat
systemctl start sysstat

# Create monitoring script
cat > /opt/digital-signature/scripts/monitor.sh << 'EOF'
#!/bin/bash
# System monitoring script

echo "=== System Status $(date) ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1

echo "Memory Usage:"
free -h

echo "Disk Usage:"
df -h

echo "Application Status:"
systemctl status digital-signature.service --no-pager

echo "Database Status:"
systemctl status postgresql --no-pager
EOF

chmod +x /opt/digital-signature/scripts/monitor.sh
```

## Backup Strategy

### 1. Database Backup
```bash
# Create backup script
cat > /opt/digital-signature/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/digital-signature/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="digital_signature_db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -h localhost -U sigapp_user $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x /opt/digital-signature/scripts/backup-db.sh
```

### 2. Application Backup
```bash
# Create application backup script
cat > /opt/digital-signature/scripts/backup-app.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/digital-signature/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
    --exclude='*.log' \
    --exclude='*.tmp' \
    /opt/digital-signature/app \
    /opt/digital-signature/config

# Remove backups older than 30 days
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +30 -delete

echo "Application backup completed: app_backup_$DATE.tar.gz"
EOF

chmod +x /opt/digital-signature/scripts/backup-app.sh
```

### 3. Automated Backup Schedule
```bash
# Add to crontab
crontab -e

# Add these lines:
# Daily database backup at 2 AM
0 2 * * * /opt/digital-signature/scripts/backup-db.sh

# Weekly application backup on Sundays at 3 AM
0 3 * * 0 /opt/digital-signature/scripts/backup-app.sh

# Daily system monitoring report
0 6 * * * /opt/digital-signature/scripts/monitor.sh > /opt/digital-signature/logs/daily-monitor.log
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Service Won't Start
```bash
# Check service status
systemctl status digital-signature.service

# Check logs
journalctl -u digital-signature.service -f

# Check application logs
tail -f /opt/digital-signature/logs/application.log
```

#### 2. Database Connection Issues
```bash
# Test database connection
psql -h localhost -U sigapp_user -d digital_signature_db

# Check PostgreSQL status
systemctl status postgresql

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-12-main.log
```

#### 3. SSL Certificate Issues
```bash
# Check certificate status
certbot certificates

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Renew certificate manually
certbot renew --dry-run
```

#### 4. Performance Issues
```bash
# Check system resources
htop
iotop
nethogs

# Check disk usage
df -h
du -sh /opt/digital-signature/*

# Check memory usage
free -h
cat /proc/meminfo
```

## Security Checklist

### Pre-Production Security Review
- [ ] All default passwords changed
- [ ] SSH key authentication configured
- [ ] Firewall rules properly configured
- [ ] SSL/TLS certificates installed and valid
- [ ] Automatic security updates enabled
- [ ] Fail2ban configured and running
- [ ] Unnecessary services disabled
- [ ] Application runs as non-root user
- [ ] File permissions properly set
- [ ] Log monitoring configured
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting set up

## Maintenance Schedule

### Daily Tasks
- [ ] Check system logs for errors
- [ ] Monitor disk space usage
- [ ] Verify application is running
- [ ] Check backup completion

### Weekly Tasks
- [ ] Review security logs
- [ ] Update system packages
- [ ] Test backup restoration
- [ ] Performance monitoring review

### Monthly Tasks
- [ ] Security audit
- [ ] Certificate expiration check
- [ ] Log file cleanup
- [ ] Performance optimization review

## Conclusion

This guide provides a comprehensive approach to provisioning a secure Ubuntu 20.04 server for digital signature applications. Follow these steps carefully, adapt the configurations to your specific requirements, and always test in a staging environment before deploying to production.

Remember to:
- Keep the system updated
- Monitor logs regularly
- Maintain proper backups
- Follow security best practices
- Document any custom configurations

For additional security considerations specific to digital signature applications, ensure compliance with relevant regulations (e.g., eIDAS, ESIGN Act) and implement proper audit logging for all signature operations.