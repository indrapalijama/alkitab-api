const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const port = process.env.PORT || 8000;
const app = express();
const path = require('path');

//documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');


//heroku config
if (process.env.NODE_ENV === 'development') {
    swaggerDocument.host = "localhost:" + process.env.PORT;
} else {
    swaggerDocument.schemes = "https";
    swaggerDocument.host = process.env.APP_NAME + ".herokuapp.com"; //heroku app name
}

//get chapter metadata
app.get('/find/:book', (req, res) => {
    var book = req.params.book;
    if (req.params.book.length > 3) {
        book = req.params.book.substring(0, 3)
    }
    book = book.charAt(0).toUpperCase() + book.slice(1)
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
        //default version (terjemahan baru)
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

//daily reflection
app.get('/renungan/:source', (req, res) => {
    let from;
    var source = req.params.source; //sh, rh

    switch (req.params.source) {
        case 'sh':
            from = 'Santapan Harian'
            break;

        case 'rh':
            from = 'Renungan Harian'
            break;

        default:
            from = 'Source Not Defined'
            break;
    }
    const url = 'https://alkitab.mobi/renungan/' + source;
    axios.get(url).then(({ data }) => {
        let $ = cheerio.load(data);
        var title = [];
        var body = [];
        var passage = [];

        //begin cheerio scrapping
        $('div').filter((i, el) => {
            let data = $(el);
            let strong = data.find('strong').first().text();
            title.push(strong);
            passage.push(data.find('p').text().split(strong)[0])
            body.push(data.find('p').text().split(strong)[1]);
        })

        //filter out the undefined or empty string values
        var filteredTitle = title.filter(function (el) {
            return el != '';
        });
        var filteredBody = body.filter(function (el) {
            return el != undefined;
        });
        var filteredPassage = passage.filter(function (el) {
            return el != undefined;
        });
        var content = filteredBody[0].split('* * *')[0]

        //return the data back
        return res.send({
            source: from,
            title: filteredTitle[0],
            passage: source == 'sh' ? filteredPassage[0].split('Bacaan:')[1].trim() : filteredPassage[0].split('Bacaan Setahun:')[1].split('Nas')[0],
            content: content
        });
    })
})

//swagger settings
var options = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Alkitab API ❤️",
    customfavIcon: "/assets/favicon.ico"
};
app.use('/assets', express.static('assets'));
app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

//settings port and welcome page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
})
app.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
});




