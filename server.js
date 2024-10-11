const cors = require("cors");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/data", express.static("data"));

// Running server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Login user's
const readUsersFromFile = () => {
  const data = fs.readFileSync("./data/users.json");
  const jsonData = JSON.parse(data);
  return jsonData.users;
};

// get the users that already logged in
app.get("/api/users", (req, res) => {
  const users = readUsersFromFile();
  res.json(users);
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const users = readUsersFromFile();
  const adminUser = users.find((user) => user.username === username);

  if (!adminUser) {
    return res
      .status(401)
      .json({ message: "Неверное имя пользователя или пароль" });
  }

  if (adminUser.password === password) {
    const token = jwt.sign({ username: adminUser.username }, "secret_key", {
      expiresIn: "1h",
    });
    return res.json({ message: "Успешный вход", token });
  } else {
    return res
      .status(401)
      .json({ message: "Неверное имя пользователя или пароль" });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "data"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

//                                                                       Tarif's CRUD
// Get data tarif
app.get("/api/home-tarif", (req, res) => {
  const dataPath = path.join(__dirname, "data", "homeTarif.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    res.json(jsonData["home-tarif"]);
  });
});

// add data tarif
app.post("/api/home-tarif", upload.single("image"), (req, res) => {
  const dataPath = path.join(__dirname, "data", "homeTarif.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }

    const jsonData = JSON.parse(data);
    const newId =
      jsonData["home-tarif"].length > 0
        ? Math.max(...jsonData["home-tarif"].map((t) => t.id)) + 1
        : 1;

    const newTarif = {
      id: newId,
      name: req.body.name,
      speed: req.body.speed,
      traffic: req.body.traffic,
      accessSpeed: req.body.accessSpeed,
      price: req.body.price,
      image: req.file ? `/data/${req.file.filename}` : null,
    };

    jsonData["home-tarif"].push(newTarif);
    jsonData.stats.updatedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res.status(201).json({
        message: "Тариф добавлен",
        tarifs: newTarif,
      });
    });
  });
});

// delete data tarif
app.delete("/api/home-tarif/:id", (req, res) => {
  const tarifId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "homeTarif.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const tarifIndex = jsonData["home-tarif"].findIndex(
      (t) => t.id === tarifId
    );

    if (tarifIndex === -1) {
      return res.status(404).send("Тариф не найден");
    }
    const tarifToDelete = jsonData["home-tarif"][tarifIndex];
    const imagePath = path.join(__dirname, tarifToDelete.image);
    jsonData["home-tarif"].splice(tarifIndex, 1);
    jsonData.stats.deletedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления изображения:", err);
          return res.status(200).json({
            message: "Тариф удален, но изображение не удалось удалить",
            tarif: tarifToDelete,
          });
        }
        res.status(200).json({
          message: "Тариф и изображение успешно удалены",
          tarif: tarifToDelete,
        });
      });
    });
  });
});

// edit data tarif
app.put("/api/home-tarif/:id", upload.single("image"), (req, res) => {
  const tarifId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "homeTarif.json");

  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const tarifIndex = jsonData["home-tarif"].findIndex(
      (t) => t.id === tarifId
    );

    if (tarifIndex === -1) {
      return res.status(404).send("Тариф не найден");
    }
    const existingTarif = jsonData["home-tarif"][tarifIndex];

    existingTarif.name = req.body.name || existingTarif.name;
    existingTarif.speed = req.body.speed || existingTarif.speed;
    existingTarif.traffic = req.body.traffic || existingTarif.traffic;
    existingTarif.accessSpeed =
      req.body.accessSpeed || existingTarif.accessSpeed;
    existingTarif.price = req.body.price || existingTarif.price;

    if (req.file) {
      const newImagePath = `/data/${req.file.filename}`;
      const oldImagePath = path.join(__dirname, existingTarif.image);

      existingTarif.image = newImagePath;

      fs.unlink(oldImagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления старого изображения:", err);
        }
      });
    } 

    jsonData.stats.updatedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res
        .status(200)
        .json({ message: "Тариф успешно обновлен", tarif: existingTarif });
    });
  });
});

// Get tarif stats
app.get("/api/home-tarif/stats", (req, res) => {
  const dataPath = path.join(__dirname, "data", "homeTarif.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const addedCount = jsonData["home-tarif"].length;
    const updatedCount = jsonData.stats.updatedCount;
    const deletedCount = jsonData.stats.deletedCount;
    res.json({
      added: addedCount,
      updated: updatedCount,
      deleted: deletedCount,
    });
  });
});

//                             swiper CRUD
app.get("/api/swiper-data", (req, res) => {
  const dataPath = path.join(__dirname, "data", "swiperdata.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    res.json(jsonData["swiper-data"]);
  });
});

// add data swiper
app.post("/api/swiper-data", upload.single("image"), (req, res) => {
  const dataPath = path.join(__dirname, "data", "swiperdata.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const newId =
      jsonData["swiper-data"].length > 0
        ? Math.max(...jsonData["swiper-data"].map((s) => s.id)) + 1
        : 1;
    const newSwiper = {
      id: newId,
      title: req.body.title,
      description: req.body.description,
      image: req.file ? `/data/${req.file.filename}` : null,
    };
    jsonData["swiper-data"].push(newSwiper);

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res.status(201).json({
        message: "Слайдер добавлен",
        swiper: newSwiper,
      });
    });
  });
});

// delete data swiper
app.delete("/api/swiper-data/:id", (req, res) => {
  const swiperId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "swiperdata.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const swiperIndex = jsonData["swiper-data"].findIndex(
      (s) => s.id === swiperId
    );
    if (swiperIndex === -1) {
      return res.status(404).send("Слайдер не найден");
    }
    const swiperToDelete = jsonData["swiper-data"][swiperIndex];
    const imagePath = path.join(__dirname, swiperToDelete.image);
    jsonData["swiper-data"].splice(swiperIndex, 1);

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления изображения:", err);
          return res.status(200).json({
            message: "Слайдер удален, но изображение не удалось удалить",
            swiper: swiperToDelete,
          });
        }
        res.status(200).json({
          message: "Слайдер и изображение успешно удалены",
          swiper: swiperToDelete,
        });
      });
    });
  });
});

// edit data swiper
app.put(
  "/api/swiper-data/:id",
  upload.single("image", (req, res) => {
    const swiperId = parseInt(req.params.id, 10);
    const dataPath = path.join(__dirname, "data", "swiperdata.json");

    fs.readFile(dataPath, "utf8", (err, data) => {
      if (err) {
        return res.status(500).send("Ошибка чтения данных");
      }
      const jsonData = JSON.parse(data);
      const swiperIndex = jsonData["swiper-data"].findIndex(
        (s) => s.id === swiperId
      );
      if (swiperIndex === -1) {
        return res.status(404).send("Слайдер не найден");
      }
      const existingSwiper = jsonData["swiper-data"][swiperIndex];

      existingSwiper.title = req.body.title || existingSwiper.title;
      existingSwiper.description =
        req.body.description || existingSwiper.description;
      if (req.file) {
        const newImagePath = `/data/${req.file.filename}`;
        const oldImagePath = path.join(__dirname, existingSwiper.image);
        existingSwiper.image = newImagePath;

        fs.unlink(oldImagePath, (err) => {
          if (err) {
            console.error("Ошибка удаления старого изображения:", err);
          }
        });
      }
      fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          return res.static(500).send("Ошибка записи данных");
        }
        res
          .static(200)
          .json({ message: "Слайд успешно обновлен", slide: existingSwiper });
      });
    });
  })
);

//                           eqpt CRUD

// get data eqpt
app.get("/api/eqpt", (req, res) => {
  const dataPath = path.join(__dirname, "data", "eqpt.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    res.json(jsonData["eqpt"]);
  });
});

// add data eqpt
app.post("/api/eqpt", upload.single("image"), (req, res) => {
  const dataPath = path.join(__dirname, "data", "eqpt.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const newId =
      jsonData["eqpt"].length > 0
        ? Math.max(...jsonData["eqpt"].map((t) => t.id)) + 1
        : 1;

    const newEqpt = {
      id: newId,
      modele: req.body.modele,
      type: req.body.type,
      bandwidth: req.body.bandwidth,
      coverage: req.body.coverage,
      support: req.body.support,
      price: req.body.price,
      image: req.file ? `/data/${req.file.filename}` : null,
    };
    jsonData["eqpt"].push(newEqpt);
    jsonData.stats.addedCount++;
    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res
        .status(201)
        .json({ message: "Оборудование добавлено", eqpt: newEqpt });
    });
  });
});

// delete data eqpt
app.delete("/api/eqpt/:id", (req, res) => {
  const eqptId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "eqpt.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const eqptIndex = jsonData["eqpt"].findIndex((t) => t.id === eqptId);
    if (eqptIndex === -1) {
      return res.status(404).send("Оборудование не найдено");
    }
    const eqptToDelete = jsonData["eqpt"][eqptIndex];
    const imagePath = path.join(__dirname, eqptToDelete.image);
    jsonData["eqpt"].splice(eqptIndex, 1);
    jsonData.stats.deletedCount++;
    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления изображения:", err);
          return res.status(200).json({
            message: "Оборудование удален, но изображение не удалось удалить",
            eqpt: eqptToDelete,
          });
        }
        res.status(200).json({
          message: "Оборудование и изображение успешно удалены",
          eqpt: eqptToDelete,
        });
      });
    });
  });
});

// edit data eqpt
app.put("api/eqpt/:id", upload.single("image"), (req, res) => {
  const eqptId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "eqpt.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const eqptIndex = jsonData["eqpt"].findIndex((t) => t.id === eqptId);
    if (eqptIndex === -1) {
      return res.status(404).send("Оборудование не найдено");
    }
    const existingEqpt = jsonData["eqpt"][eqptIndex];
    existingEqpt.modele = req.body.modele || existingEqpt.modele;
    existingEqpt.type = req.body.type || existingEqpt.type;
    existingEqpt.bandwidth = req.body.bandwidth || existingEqpt.bandwidth;
    existingEqpt.coverage = req.body.coverage || existingEqpt.coverage;
    existingEqpt.support = req.body.support || existingEqpt.support;
    existingEqpt.price = req.body.price || existingEqpt.price;
    if (req.file) {
      const newImagePath = `/data/${req.file.filename}`;
      const oldImagePath = path.join(__dirname, existingEqpt.image);
      existingEqpt.image = newImagePath;
      fs.unlink(oldImagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления старого изображения:", err);
        }
      });
    }
    jsonData.stats.updatedCount++;
    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res.status(200).json({
        message: "Оборудование и изображение успешно изменены",
        eqpt: existingEqpt,
      });
    });
  });
});

// get eqpt stats
app.get("/api/eqpt/stats", (req, res) => {
  const dataPath = path.join(__dirname, "data", "eqpt.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const addedCount = jsonData["eqpt"].length;
    const updatedCount = jsonData.stats.updatedCount;
    const deletedCount = jsonData.stats.deletedCount;
    res.json({
      added: addedCount,
      updated: updatedCount,
      deleted: deletedCount,
    });
  });
});

//                                                                        News's CRUD
// Get all news articles
app.get("/api/news", (req, res) => {
  const dataPath = path.join(__dirname, "data", "news.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    res.json(jsonData["news"]);
  });
});

// Add a new news article
app.post("/api/news", upload.single("image"), (req, res) => {
  const dataPath = path.join(__dirname, "data", "news.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }

    const jsonData = JSON.parse(data);
    const newId =
      jsonData["news"].length > 0
        ? Math.max(...jsonData["news"].map((n) => n.id)) + 1
        : 1;

    const newNews = {
      id: newId,
      title: req.body.title,
      date: req.body.date,
      description: req.body.description,
      image: req.file ? `/data/${req.file.filename}` : null,
    };

    jsonData["news"].push(newNews);
    jsonData.stats.updatedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res.status(201).json(newNews);
    });
  });
});

// Update a news article
app.put("/api/news/:id", upload.single("image"), (req, res) => {
  const newsId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "news.json");

  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const newsIndex = jsonData["news"].findIndex((n) => n.id === newsId);

    if (newsIndex === -1) {
      return res.status(404).send("Новость не найдена");
    }

    const existingNews = jsonData["news"][newsIndex];

    existingNews.title = req.body.title || existingNews.title;
    existingNews.date = req.body.date || existingNews.date;
    existingNews.description = req.body.description || existingNews.description;

    if (req.file) {
      const newImagePath = `/data/${req.file.filename}`;
      const oldImagePath = path.join(__dirname, existingNews.image);

      existingNews.image = newImagePath;

      fs.unlink(oldImagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления старого изображения:", err);
        }
      });
    }

    jsonData.stats.updatedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res
        .status(200)
        .json({ message: "Новость успешно обновлена", news: existingNews });
    });
  });
});

// Delete a news article
app.delete("/api/news/:id", (req, res) => {
  const newsId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "news.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const newsIndex = jsonData["news"].findIndex((n) => n.id === newsId);

    if (newsIndex === -1) {
      return res.status(404).send("Новость не найдена");
    }

    const newsToDelete = jsonData["news"][newsIndex];
    const imagePath = path.join(__dirname, newsToDelete.image);

    jsonData["news"].splice(newsIndex, 1);
    jsonData.stats.deletedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Ошибка удаления изображения:", err);
          return res.status(200).json({
            message: "Новость удалена, но изображение не удалось удалить",
            news: newsToDelete,
          });
        }
        res.status(200).json({
          message: "Новость и изображение успешно удалены",
          news: newsToDelete,
        });
      });
    });
  });
});

// get news stats
app.get("/api/news/stats", (req, res) => {
  const dataPath = path.join(__dirname, "data", "news.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const addedCount = jsonData["news"].length;
    const updatedCount = jsonData.stats.updatedCount;
    const deletedCount = jsonData.stats.deletedCount;
    res.json({
      added: addedCount,
      updated: updatedCount,
      deleted: deletedCount,
    });
  });
});

//                                                                            Faqs's CRUD
// Get all FAQs
app.get("/api/faq", (req, res) => {
  const dataPath = path.join(__dirname, "data", "faq.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    res.json(jsonData["faq"]);
  });
});

// Add a new FAQ entry
app.post("/api/faq", (req, res) => {
  const dataPath = path.join(__dirname, "data", "faq.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }

    const jsonData = JSON.parse(data);

    const newId =
      jsonData["faq"].length > 0
        ? Math.max(...jsonData["faq"].map((f) => f.id)) + 1
        : 1;

    const newFaq = {
      id: newId,
      question: req.body.question,
      answer: req.body.answer,
    };

    jsonData["faq"].push(newFaq);
    jsonData.stats.updatedCount++;
    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res.status(201).json(newFaq);
    });
  });
});

// Update an FAQ entry
app.put("/api/faq/:id", (req, res) => {
  const faqId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "faq.json");

  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const faqIndex = jsonData["faq"].findIndex((f) => f.id === faqId);

    if (faqIndex === -1) {
      return res.status(404).send("FAQ не найдена");
    }

    const existingFaq = jsonData["faq"][faqIndex];
    existingFaq.question = req.body.question || existingFaq.question;
    existingFaq.answer = req.body.answer || existingFaq.answer;
    jsonData.stats.updatedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res
        .status(200)
        .json({ message: "FAQ успешно обновлена", faq: existingFaq });
    });
  });
});

// Delete an FAQ entry
app.delete("/api/faq/:id", (req, res) => {
  const faqId = parseInt(req.params.id, 10);
  const dataPath = path.join(__dirname, "data", "faq.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const faqIndex = jsonData["faq"].findIndex((f) => f.id === faqId);

    if (faqIndex === -1) {
      return res.status(404).send("FAQ не найдена");
    }

    const faqToDelete = jsonData["faq"][faqIndex];
    jsonData["faq"].splice(faqIndex, 1);
    jsonData.stats.deletedCount++;

    fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        return res.status(500).send("Ошибка записи данных");
      }
      res
        .status(200)
        .json({ message: "FAQ успешно удалена", faq: faqToDelete });
    });
  });
});

// get faqs stats
app.get("/api/faq/stats", (req, res) => {
  const dataPath = path.join(__dirname, "data", "faq.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Ошибка чтения данных");
    }
    const jsonData = JSON.parse(data);
    const addedCount = jsonData["faq"].length;
    const updatedCount = jsonData.stats.updatedCount;
    const deletedCount = jsonData.stats.deletedCount;
    res.json({
      added: addedCount,
      updated: updatedCount,
      deleted: deletedCount,
    });
  });
});
