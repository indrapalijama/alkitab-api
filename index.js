const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const port = process.env.PORT || 8000;
const app = express();
var cors = require('cors');

//documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

// if (process.env.NODE_ENV === 'development') {
// swaggerDocument.host = "localhost:" + process.env.PORT
// } else {
// swaggerDocument.schemes = "https"
// swaggerDocument.host = "fulk-alkitab-api.herokuapp.com:" + process.env.PORT
swaggerDocument.host = "0.0.0.0:" + process.env.PORT
// }

app.options('*', cors()) // include before other routes
app.use(cors());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "0.0.0.0:" + process.env.PORT); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//get chapter metadata
app.get('/find/:book', (req, res) => {
    var book = req.params.book;
    if (req.params.book.length > 3) {
        book = req.params.book.substring(0, 3)
    }
    const url = 'https://alkitab.mobi/tb/' + book;
    axios.get(url).then(({ data }) => {
        let $ = cheerio.load(data);
        let href = []
        $('a').filter((i, el) => {
            let data = $(el);
            href.push(data.attr('href'))
        })
        let match = [];
        let verses = [];
        href.forEach(element => {
            var string2 = book;
            var regex = new RegExp(string2, 'g');
            if (element.match(regex)) {
                match.push(element)
            }
        });
        match.forEach(element => {
            if (element.match(/\d+/g)) {
                verses.push(parseInt(element.match(/\d+/g)))
            }
        });
        // return res.send(verses);
        return res.send({
            book: book,
            total_verse: verses.length,
            verses: verses
        });
    })
})

//read bible with params (book, chapter, version)
app.get('/read/:book/:chapter/:version', (req, res) => {
    var book = req.params.book;
    var chapter = req.params.chapter;
    var version;

    if (req.params.version == 'undefined' || req.params.version == '{version}') {
        //default version is terjemahan baru
        version = 'tb'
    } else {
        version = req.params.version
    }

    if (req.params.book.length > 3) {
        book = req.params.book.substring(0, 3)
    }

    const url = 'https://alkitab.mobi/' + version + '/' + book + '/' + chapter;


    axios.get(url).then(({ data }) => {
        let $ = cheerio.load(data);
        book = $('title').text().match(/[a-zA-Z]+/g);
        chapter = parseInt($('title').text().match(/\d+/g));
        let items = [];

        $('p').filter((i, el) => {
            let data = $(el);
            let lastVerse = 0;
            let content = data
                .find('[data-begin]')
                .first()
                .text();
            let title = data
                .find('.paragraphtitle')
                .first()
                .text();
            let verse = data
                .find('.reftext')
                .children()
                .first()
                .text();

            let type = null;
            let item = {};

            if (!verse) {
                verse = 0;
            } else {
                verse = parseInt(verse, 10);
            }

            if (!title && !content) {
                data.find('.reftext').remove();
                content = data.text();
            }

            if (title) {
                type = 'title';
                content = title;
                verse = lastVerse + 1;
            } else if (content) {
                type = 'content';
                lastVerse = verse;
            }

            if (data.attr('hidden') === 'hidden' || data.hasClass('loading') || data.hasClass('error')) {
                type = null;
            }

            if (type) {
                item = {
                    verse,
                    content
                };
                items.push(item);
            }
            return item;
        });

        let result = items;
        return res.send({
            verses: result,
            book,
            chapter
        });
    })
})


app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
    res.send('404')
})

app.listen({ port }, () => {
    console.log(`🚀 Server ready at port http://localhost:${port}`);
});




