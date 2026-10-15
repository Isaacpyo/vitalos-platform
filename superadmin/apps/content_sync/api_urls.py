from django.urls import path, re_path

from . import api

app_name = "content_api"

SLUG = r"(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)"

urlpatterns = [
    path("site-state", api.site_state, name="site_state"),
    path("home", api.home, name="home"),
    path("sitemap", api.sitemap, name="sitemap"),
    path("health", api.health, name="health"),
    path("tick", api.run_tick, name="tick"),
    path("insights/posts", api.insights_posts, name="posts"),
    re_path(rf"^insights/posts/{SLUG}$", api.insights_post, name="post"),
    re_path(rf"^insights/authors/{SLUG}$", api.insights_author, name="author"),
    path("insights/topics", api.insights_topics, name="topics"),
    re_path(rf"^insights/topics/{SLUG}$", api.insights_topic, name="topic"),
    path("insights/feed", api.insights_feed, name="feed"),
    path("careers/page", api.careers_page, name="careers_page"),
    re_path(rf"^careers/roles/{SLUG}$", api.careers_role, name="role"),
    re_path(r"^preview/(?P<entity>[a-z]+)/(?P<item_id>[0-9a-f-]{36})$", api.preview, name="preview"),
    re_path(r"^.*$", api.not_found),
]
