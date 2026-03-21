import { useState } from 'react'
import hu from './hu.module.css'

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
    <section style={{
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '30px',
    }}>
      <h2 style={{
        fontSize: "46px",
        fontWeight: '900',
        lineHeight: "130%",
      }}>Стань частью IT-сообщества</h2>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '30px',
        fontSize: 16
      }} className='hu_tabs_header'>
        {HU_TABS.map((tab, index) => 
            <div key={index} onClick={() => setA(index)}>
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
            <h3>Экосистема «Трампмох»</h3>
            <p>Транс</p>
            <ul>
                <li>Находи менторов</li>
                <li>Участвуй в ивентах компаний</li>
                <li>Получай офферы за свои навыки</li>
            </ul>
        </div>
    )
}
function Praktiki () {

    return (
        <div>
            <h3>Экосистема «Трамплох»</h3>
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
            <h3>Экосистема «Трампплох»</h3>
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
            <h3>Экосистема «Трамп»</h3>
            <p>Карьера с первого курса: наставничество, нетворкинг, стажировки. Твой старт здесь!</p>
            <ul>
                <li>Находи менторов</li>
                <li>Участвуй в ивентах компаний</li>
                <li>Получай офферы за свои навыки</li>
            </ul>
        </div>
    )
}