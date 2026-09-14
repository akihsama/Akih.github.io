---
layout: default
title: 文章
---

# 文章

<ul class="post-list">
  {% for post in site.posts %}
    <li>
      <div>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        {% if site.show_excerpts %}<p class="excerpt">{{ post.excerpt | strip_html | truncate: 90 }}</p>{% endif %}
      </div>
      <span class="date">{{ post.date | date: "%Y-%m-%d" }}</span>
    </li>
  {% endfor %}
</ul>
