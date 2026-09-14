---
layout: default
title: 首页
---

<section class="hero">
  <p class="hi">你好,我是<span style="color:var(--accent)"> 你的名字</span></p>
  <p class="role">前端工程师 / 独立开发者 / 记录者</p>
  <p class="bio">
    我专注于构建简洁、可维护的 Web 应用,热爱开源与分享。
    这里是我的个人主页与博客,记录我的技术笔记与生活碎片。
  </p>
  <div class="actions">
    <a class="btn" href="{{ "/blog" | relative_url }}">阅读文章</a>
    <a class="btn ghost" href="{{ "/contact" | relative_url }}">联系我</a>
  </div>
</section>

<section>
  <h2>近期项目</h2>
  <div class="cards">
    <div class="card">
      <span class="tag">开源</span>
      <h3>项目一</h3>
      <p>一句话介绍这个项目解决了什么问题,以及亮点在哪里。</p>
    </div>
    <div class="card">
      <span class="tag">工具</span>
      <h3>项目二</h3>
      <p>说明它的使用场景,附上仓库或演示链接(把文字替换成 <a href="#">链接</a>)。</p>
    </div>
    <div class="card">
      <span class="tag">实验</span>
      <h3>项目三</h3>
      <p>正在探索中的小作品,描述当前的状态与计划。</p>
    </div>
  </div>
</section>

<section>
  <h2>最近在写</h2>
  <ul class="post-list">
    {% for post in site.posts limit:3 %}
      <li>
        <div>
          <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        </div>
        <span class="date">{{ post.date | date: "%Y-%m-%d" }}</span>
      </li>
    {% endfor %}
  </ul>
</section>
