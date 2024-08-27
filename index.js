import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Book",
  password: "Codingshit2144",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function getData(searchTerm) {
  const url = `https://openlibrary.org/search.json?q=${searchTerm}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const data = await response.json();
    const result = data.docs;
    const coverId = result.map((book) => book.cover_i);
    const bookTitle = result.map((book) => book.title);
    const author = result.map((book) =>
      book.author_name ? book.author_name[0] : "Unknown"
    );
    return {
      bookTitle: bookTitle,
      author: author,
      coverId: coverId,
    };
  } catch (error) {
    console.error(error.message);
  }
}

app.get("/", async (req, res) => {
  const info = getData();
  const books = await db.query(
    "SELECT * FROM books JOIN book_reviews ON books.id = book_reviews.book_id"
  );

  res.render("index.ejs", { books: books.rows });
});

app.post("/add", async (req, res) => {
  try {
    const test = await db.query("SELECT title FROM books");
    var exist = false;
    var i = 0;
    while (i < test.rows.length) {
      if (test.rows[i].title.toLowerCase() == req.body.book.toLowerCase()) {
        exist = true;
      }
      i += 1;
    }
    if (exist == true) {
      const books = await db.query(
        "SELECT * FROM books JOIN book_reviews ON books.id = book_reviews.book_id where Lower(title) = ($1)",
        [req.body.book.toLowerCase()]
      );
      res.render("edit.ejs", { books: books.rows[0] });
    } else {
      const result = req.body.book.toLowerCase();
      const info = await getData(result);
      var sorted = info.bookTitle.map(function (value) {
        return value.toLowerCase();
      });
      const index = sorted.indexOf(result);
      const coverId = info.coverId[index];
      console.log(coverId);
      if (coverId == undefined) {
        console.log("works");

        res.redirect("/");
      } else {
        const titleId = info.bookTitle[index];
        const authorId = info.author[index];

        res.render("new.ejs", {
          coverId: coverId,
          titleId: titleId,
          authorId: authorId,
        });
      }
    }
  } catch (error) {
    console.log("Error: ", error);
  }
});

app.post("/review", async (req, res) => {
  try {
    const review = req.body.review;

    const book = await db.query(
      "INSERT INTO books (coverid,author ,title) VALUES ($1, $2, $3) RETURNING id",
      [req.body.cover, req.body.author, req.body.title]
    );

    const newReview = await db.query(
      "INSERT INTO book_reviews (book_id,review_text) VALUES ($1,$2) ",
      [book.rows[0].id, req.body.review]
    );

    res.redirect("/");
  } catch (error) {
    console.log("Error: ", error);
  }
});

app.get("/edit/:id", async (req, res) => {
  let number = req.params.id;
  const books = await db.query(
    "SELECT * FROM books JOIN book_reviews ON books.id = book_reviews.book_id where id = ($1)",
    [number]
  );
  res.render("edit.ejs", { books: books.rows[0] });
});

app.post("/editReview/:id", async (req, res) => {
  let number = req.params.id;
  console.log(number);
  let newText = req.body.update;
  await db.query(
    "UPDATE book_reviews SET review_text = ($1) where book_id = ($2)  ",
    [newText, number]
  );
  res.redirect("/");
});

app.post("/delete/:id", async (req, res) => {
  let number = req.params.id;
  console.log(number);
  await db.query("DELETE FROM book_reviews where book_id = ($1);", [number]);
  await db.query(
    `DELETE FROM books
    WHERE id = $1`,
    [number]
  );
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
