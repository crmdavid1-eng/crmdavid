import type { Metadata } from "next";

export const metadata: Metadata = { title: "Политика конфиденциальности" };

/** Публичная страница: Meta требует ссылку на политику для приложения WhatsApp. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[0.95rem] leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Политика конфиденциальности</h1>
      <p className="mt-4">
        Эта CRM используется индивидуальным предпринимателем для учёта обращений клиентов. Когда вы пишете нам в WhatsApp, оставляете заявку
        на сайте или в рекламной форме, мы сохраняем ваше имя, номер телефона, никнейм в Instagram и текст переписки.
      </p>
      <h2 className="mt-6 font-semibold">Зачем</h2>
      <p className="mt-2">Только чтобы ответить на ваш запрос, связаться с вами по нему и вести историю общения. Мы не продаём и не передаём данные третьим лицам.</p>
      <h2 className="mt-6 font-semibold">Где хранятся</h2>
      <p className="mt-2">В защищённой базе данных (Supabase). Доступ есть только у владельца CRM по логину и паролю.</p>
      <h2 className="mt-6 font-semibold">Удаление</h2>
      <p className="mt-2">Напишите нам в WhatsApp «удалите мои данные», и мы удалим вашу карточку и переписку.</p>
    </main>
  );
}
