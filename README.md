# centralized-logging-system

Building a Centralized Logging system without utilizing any Cloud Services

You can download this repository by using the green ``Clone or Download`` button on the right hand side of this page. This will present you with the option to either clone the repository using Git, or to download it as a zip file.

If you want to download it using git, copy paste the link that is presented to you, then run the following at your terminal:
 ```
https://github.com/Rahul-Barick/centralized-logging-system
cd centralized-logging-system
npm install
```

Run Docker Compose file which help you with virtual Postgres & PgAdmin running on your system
```
docker-compose up
```

Migrate Postgres Db Tables
```
npm run db:setup
```

Start the program
```
npm run start
```
