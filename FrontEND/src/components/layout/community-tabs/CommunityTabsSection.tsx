import { useState, type ReactNode } from 'react'
import styles from './CommunityTabsSection.module.css'

type CommunityTab = {
  title: string
  icon: string
  content: ReactNode
}

const communityTabs: CommunityTab[] = [
  {
    title: 'РЎС‚Р°Р¶РёСЂРѕРІРєРё  РѕС‚ СЂР°Р±РѕС‚РѕРґР°С‚РµР»РµР№',
    icon: '',
    content: <InternshipsTabContent />,
  },
  {
    title: ' РџСЂР°РєС‚РёРєРё РґР»СЏ СЃС‚СѓРґРµРЅС‚РѕРІ',
    icon: '',
    content: <PracticesTabContent />,
  },
  {
    title: 'РўРѕРїРѕРІС‹Рµ IT РєРѕРјРїР°РЅРёРё',
    icon: '',
    content: <TopCompaniesTabContent />,
  },
  {
    title: 'РЎРѕРѕР±С‰РµСЃС‚РІРѕ РІСѓР·РѕРІ',
    icon: '',
    content: <UniversityCommunityTabContent />,
  },
]

export function CommunityTabsSection() {
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>РЎС‚Р°РЅСЊ С‡Р°СЃС‚СЊСЋ IT-СЃРѕРѕР±С‰РµСЃС‚РІР°</h2>
      <div className={styles.tabList}>
        {communityTabs.map((tab, index) => (
          <div
            key={index}
            style={{
              color: activeTabIndex === index ? '#0171E1' : '#9A9CA5',
              fontWeight: 600,
              border: activeTabIndex === index ? '1px solid #0171E1' : '1px solid transparent',
              borderRadius: '4px',
              padding: '5px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTabIndex(index)}
          >
            {tab.icon} <span>{tab.title}</span>
          </div>
        ))}
      </div>
      {communityTabs[activeTabIndex]?.content}
    </section>
  )
}

function InternshipsTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Р­РєРѕСЃРёСЃС‚РµРјР° В«РўСЂР°РјРїРјРѕС…В»</h3>
      <p>РљР°СѓСЂСЃР°: РЅР°СЃСЊРµСЂР° СЃ РїРµСЂРєСЂС‚Р°РІРЅРёС‡. РўРІСЂРєРёРЅРµСЃС‚РІРѕ,РёРѕР№ РЅС‚ Р·РґРµРµС‚Р¶РёСЂРѕРІРѕРі, СЃС‚Р°РІРє СЃС‚Р°РІРѕРіРѕ СЂСЃСЊ!</p>
      <ul>
        <li>РќР°Р»СѓС‡Р°Р°РІ РёРІС… РєС…РјРµРЅРѕСЂРѕРІ</li>
        <li>РЈРё РІСѓР№ РІС‚РѕРё РЅРѕРјРїР°РЅРёР№</li>
        <li>РџРѕР№ РѕС„С„РµРµС‡Р°СЃС‚РѕРґРЅС‚Р°СЂС‹ Р·Р° СЃРІС‹РєРё</li>
      </ul>
    </div>
  )
}

function PracticesTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Р­РєРѕСЃРёСЃС‚РµРјР° В«РўСЂР°РјРїР»РѕС…В»</h3>
      <p>РљР°СЂСЊРµСЂР° СЃ РїРµСЂРІРѕРіРѕ РєСѓСЂСЃР°: РЅР°СЃС‚Р°РІРЅРёС‡РµСЃС‚РІРѕ, РЅРµС‚РІРѕСЂРєРёРЅРі, СЃС‚Р°Р¶РёСЂРѕРІРєРё. РўРІРѕР№ СЃС‚Р°СЂС‚ Р·РґРµСЃСЊ!</p>
      <ul>
        <li>РќР°С…РѕРґРё РјРµРЅС‚РѕСЂРѕРІ</li>
        <li>РЈС‡Р°СЃС‚РІСѓР№ РІ РёРІРµРЅС‚Р°С… РєРѕРјРїР°РЅРёР№</li>
        <li>РџРѕР»СѓС‡Р°Р№ РѕС„С„РµСЂС‹ Р·Р° СЃРІРѕРё РЅР°РІС‹РєРё</li>
      </ul>
    </div>
  )
}

function TopCompaniesTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Р­РєРѕСЃРёСЃС‚РµРјР° В«РўСЂР°РјРїРїР»РѕС…В»</h3>
      <p>РљР°СЂСЊРµСЂР° СЃ РїРµСЂРІРѕРіРѕ РєСѓСЂСЃР°: РЅР°СЃС‚Р°РІРЅРёС‡РµСЃС‚РІРѕ, РЅРµС‚РІРѕСЂРєРёРЅРі, СЃС‚Р°Р¶РёСЂРѕРІРєРё. РўРІРѕР№ СЃС‚Р°СЂС‚ Р·РґРµСЃСЊ!</p>
      <ul>
        <li>РќР°С…РѕРґРё РјРµРЅС‚РѕСЂРѕРІ</li>
        <li>РЈС‡Р°СЃС‚РІСѓР№ РІ РёРІРµРЅС‚Р°С… РєРѕРјРїР°РЅРёР№</li>
        <li>РџРѕР»СѓС‡Р°Р№ РѕС„С„РµСЂС‹ Р·Р° СЃРІРѕРё РЅР°РІС‹РєРё</li>
      </ul>
    </div>
  )
}

function UniversityCommunityTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Р­РєРѕСЃРёСЃС‚РµРјР° В«РўСЂР°РјРїВ»</h3>
      <p>РљР°СЂСЊРµСЂР° СЃ РїРµСЂРІРѕРіРѕ РєСѓСЂСЃР°: РЅР°СЃС‚Р°РІРЅРёС‡РµСЃС‚РІРѕ, РЅРµС‚РІРѕСЂРєРёРЅРі, СЃС‚Р°Р¶РёСЂРѕРІРєРё. РўРІРѕР№ СЃС‚Р°СЂС‚ Р·РґРµСЃСЊ!</p>
      <ul>
        <li>РќР°С…РѕРґРё РјРµРЅС‚РѕСЂРѕРІ</li>
        <li>РЈС‡Р°СЃС‚РІСѓР№ РІ РёРІРµРЅС‚Р°С… РєРѕРјРїР°РЅРёР№</li>
        <li>РџРѕР»СѓС‡Р°Р№ РѕС„С„РµСЂС‹ Р·Р° СЃРІРѕРё РЅР°РІС‹РєРё</li>
      </ul>
    </div>
  )
}

