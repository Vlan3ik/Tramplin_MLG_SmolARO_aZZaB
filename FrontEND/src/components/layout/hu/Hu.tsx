import { useState } from 'react'
import hu from './Hu.module.css'

const HU_TABS = [
  {
    title: 'Стажировки  от работодателей',
    icon: '',
    content: <Stajirovki />,
  },
  {
    title: ' Практики для студентов',
    icon: '',
    content: <Praktiki />,
  },
  {
    title: 'Топовые IT компании',
    icon: '',
    content: <Topoviecompanii />,
  },
  {
    title: 'Сообщество вузов',
    icon: '',
    content: <Soobshestvovuzov />,
  },
  
]

export function Hu() {
    const [a, setA] = useState(0);

    
  return (
    <section className={hu.i}>
      <h2 className={hu.b}>Стань частью IT-сообщества</h2>
      <div className={hu.c}>
        {HU_TABS.map((tab, index) => 
            <div style={{
                color: a === index ? "#0171E1" : "#9A9CA5",
                fontWeight: 600,
                border: a === index ? '1px solid #0171E1' : '1px solid transparent',
                borderRadius: '4px',
                padding: '5px',
                cursor: 'pointer'

            }} 
            key={index} onClick={() => setA(index)}>
                {tab.icon} <span>{tab.title}</span>
            </div>
        )}
        </div>
        {HU_TABS.find((_, index) => index === a)?.content}
    </section>
  )
}

function Stajirovki () {

    return (
        <div>
            <h3 className={hu.й}>Экосистема «Трампмох»</h3>
            <p>Каурса: насьера с перкртавнич. Твркинество,иой нт здеетжировог, ставк ставого рсь!</p>
            <ul>
                <li>Налучаав ивх кхменоров</li>
                <li>Уи вуй втои номпаний</li>
                <li>Пой оффеечастоднтары за свыки</li>
            </ul>
        </div>
    )
}
function Praktiki () {

    return (
        <div>
            <h3 className={hu.й}>Экосистема «Трамплох»</h3>
            <p>Карьера с первого курса: наставничество, нетворкинг, стажировки. Твой старт здесь!</p>
            <ul>
                <li>Находи менторов</li>
                <li>Участвуй в ивентах компаний</li>
                <li>Получай офферы за свои навыки</li>
            </ul>
        </div>
    )
}
function Topoviecompanii () {

    return (
        <div>
            <h3 className={hu.й}>Экосистема «Трампплох»</h3>
            <p>Карьера с первого курса: наставничество, нетворкинг, стажировки. Твой старт здесь!</p>
            <ul>
                <li>Находи менторов</li>
                <li>Участвуй в ивентах компаний</li>
                <li>Получай офферы за свои навыки</li>
            </ul>
        </div>
    )
}
function Soobshestvovuzov () {

    return (
        <div>
            <h3 className={hu.й}>Экосистема «Трамп»</h3>
            <p>Карьера с первого курса: наставничество, нетворкинг, стажировки. Твой старт здесь!</p>
            <ul>
                <li>Находи менторов</li>
                <li>Участвуй в ивентах компаний</li>
                <li>Получай офферы за свои навыки</li>
            </ul>
        </div>
    )
}