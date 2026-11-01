--
-- PostgreSQL database dump
--

\restrict Ag9p56bygc2fFAMkSaewUQdwL9gOsnRsxapKadxxKxnFYpsnj0hrP4F0s530qqs

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (key, value, created_at, updated_at) FROM stdin;
admin_email	hansmin95@gmail.com	2026-03-08 02:56:47.640451+00	2026-03-08 02:56:47.640451+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, slug, parent_id, level, "order", description, created_at, updated_at) FROM stdin;
915aa6f2-2d04-461c-96df-89b138832d80	개발	dev	\N	1	0	개발과 관련된 생각들	2026-03-09 14:06:44.997388+00	2026-03-09 14:09:43.086502+00
4043c76e-a83d-4394-b7b8-e4030bd8fc0a	프로젝트	projects	915aa6f2-2d04-461c-96df-89b138832d80	2	1	프로젝트에 대한 사색들	2026-03-09 14:09:01.289264+00	2026-03-09 14:09:50.689694+00
0da98637-7e42-4151-85ee-3d9c86a4a983	muse.log	muse-log	4043c76e-a83d-4394-b7b8-e4030bd8fc0a	3	0	\N	2026-03-09 14:10:18.448577+00	2026-03-09 14:10:18.448577+00
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media (id, filename, url, alt_text, size, mime_type, created_at) FROM stdin;
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.posts (id, title, slug, content, excerpt, category_id, created_at, updated_at, published, author_id) FROM stdin;
ec4fb1ff-1445-44a7-93f9-91ed8b6f9358	init	init	생각이 많다.\n많은 생각은 유용할 때도, 불리할 때도 있다.	사색의 공간 muse.log를 준비하는 자세	0da98637-7e42-4151-85ee-3d9c86a4a983	2026-03-09 14:13:11.878473+00	2026-03-09 14:13:11.878473+00	t	e97c86c3-3390-472f-8f7b-991fb9624139
e5a45f03-fb4e-4438-9587-b4f60922ce7d	생각 자체를 위한 여정이 아니다	not-for-the-thought-itself	사색 자체를 위한 프로젝트가 아니다. 사색하기 위해서 프로젝트하는가, 사색의 내용을 표현하기 위해 프로젝트하는가 하면, 후자이다.	프로젝트를 왜 시작했고 어디로 나아가고 싶은가	0da98637-7e42-4151-85ee-3d9c86a4a983	2026-03-09 23:16:29.303756+00	2026-03-09 23:16:29.303756+00	t	e97c86c3-3390-472f-8f7b-991fb9624139
377081d8-16bc-4b18-aadd-1a252c303ece	이것은 길이가 긴 제목을 위한 테스트 게시글일 수도, 충동적으로 긴 제목을 달고 싶은 내 의지일 수도 있다. 진짜 의도가 무엇인지는 알 수 없다.	it-can-be-a-test-or-intentional-posts	가끔 생각한다\n고로 고로고로	이것은 테스트일까, 의도된 사색일까	0da98637-7e42-4151-85ee-3d9c86a4a983	2026-03-09 23:21:58.557499+00	2026-03-09 23:21:58.557499+00	t	e97c86c3-3390-472f-8f7b-991fb9624139
\.


--
-- PostgreSQL database dump complete
--

\unrestrict Ag9p56bygc2fFAMkSaewUQdwL9gOsnRsxapKadxxKxnFYpsnj0hrP4F0s530qqs

