---
layout: default
title: 首页
---

<section class="hero">
  <p class="hi">今日食签</p>
  <p class="role">每日吃什么,摇一支食签</p>
  <p class="bio">
    灵感来自寺庙求签:摇一摇,抽一支「食签」,签上写着今天适合吃什么,附一句签语。
    还能问问食神,帮你拿定主意。每天纠结吃什么的时候,就交给它。
  </p>
  <div class="actions">
    <a class="btn" href="{{ "/app/" | relative_url }}">🎋 开始求签</a>
    <a class="btn ghost" href="{{ "/" | relative_url }}#about">关于我</a>
  </div>
</section>

<section>
  <h2>它能做什么</h2>
  <div class="cards">
    <div class="card">
      <span class="tag">求签</span>
      <h3>摇一支食签</h3>
      <p>每天纠结吃什么,摇签定夺,随机给你一道菜、配一句签语。</p>
    </div>
    <div class="card">
      <span class="tag">签语</span>
      <h3>食签卡</h3>
      <p>每支签都是一张卡:菜名、寓意与签语,像抽签占卜一样有趣。</p>
    </div>
    <div class="card">
      <span class="tag">食神</span>
      <h3>问问食神</h3>
      <p>告诉它今天想吃什么口味,帮你出主意。静态版本地使用本地食神。</p>
    </div>
  </div>
</section>

<section id="about">
  <h2>关于我</h2>
  <p>我是<span style="color:var(--accent)"> 赤彦</span>,AI 开发者,游戏设计专业学生。</p>
  <p>「今日食签」是我动手做的小项目,把每天「吃什么」这件小事,做成一支可以摇的签。</p>
</section>
