// Пример данных для новостей
const newsData = [
    {
        title: "Новость 1",
        description: "Это описание первой новости. Подробности можно прочитать ниже.",
        link: "#"
    },
    {
        title: "Новость 2",
        description: "Это описание второй новости. Подробности можно прочитать ниже.",
        link: "#"
    },
    {
        title: "Новость 3",
        description: "Это описание третьей новости. Подробности можно прочитать ниже.",
        link: "#"
    }
];

// Функция для отображения новостей
function loadNews() {
    const newsFeed = document.querySelector('.news-feed');
    newsData.forEach(news => {
        const newsCard = document.createElement('div');
        newsCard.classList.add('news-card');
        newsCard.innerHTML = `
            <h3>${news.title}</h3>
            <p>${news.description}</p>
            <a href="${news.link}" class="read-more">Читать далее</a>
        `;
        newsFeed.appendChild(newsCard);
    });
}

// Загружаем новости на страницу
loadNews();
