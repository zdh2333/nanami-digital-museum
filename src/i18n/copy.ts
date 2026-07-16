import type { Locale } from './types'

export interface Birthplace {
  city: string
  region: string
  country: string
}

export interface BirthplaceLocalization {
  names: Readonly<Record<string, string>>
  order: readonly (keyof Birthplace)[]
  separator: string
}

export function formatBirthplace(
  birthplace: Birthplace,
  localization: BirthplaceLocalization,
): string {
  return localization.order
    .map((part) => {
      const canonicalName = birthplace[part]
      const localizedName = localization.names[canonicalName]

      if (!localizedName) {
        throw new Error(`Missing birthplace translation for "${canonicalName}".`)
      }

      return localizedName
    })
    .join(localization.separator)
}

function formatProfileDate(locale: Locale, birthDate: string): string {
  const [year, month, day] = birthDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export interface MuseumCopy {
  nav: {
    home: string
    profile: string
    notes: string
    archive: string
    timeline: string
    menu: string
    close: string
  }
  hero: {
    title: string
    disclosure: string
  }
  profile: {
    eyebrow: string
    title: string
    summary: string
    born: string
    birthplace: string
    birthplaceLocalization: BirthplaceLocalization
    sex: string
    male: string
    age: string
    formatAge: (age: number) => string
    formatBirthDate: (birthDate: string) => string
    room: string
    roomCaption: string
  }
  notes: {
    eyebrow: string
    title: string
    observed: string
    ownerConfirmed: string
    eyes: NoteCopy
    tail: NoteCopy
    collar: NoteCopy
    doors: NoteCopy
  }
  archive: {
    all: string
    photos: string
    memes: string
    portraits: string
    title: string
    eyebrow: string
    summary: string
    filterLabel: string
    ribbonLabel: string
    emptyTitle: string
    empty: string
    filterEmpty: string
    missingDate: string
    imageUnavailable: string
    imageUnavailableNote: string
    view: string
    close: string
    previous: string
    next: string
    photo: string
    meme: string
    date: string
    location: string
    story: string
  }
  living: {
    eyebrow: string
    title: string
    summary: string
    born: string
    currentAge: string
    latestCapture: string
    collectionDescriptions: {
      photos: string
      memes: string
      portraits: string
    }
  }
  closing: {
    eyebrow: string
    title: string
    returnLink: string
  }
}

interface NoteCopy {
  term: string
  detail: string
  observation: string
}

export const copy: Readonly<Record<Locale, MuseumCopy>> = {
  en: {
    nav: {
      home: 'Home',
      profile: 'Profile',
      notes: 'Field Notes',
      archive: 'Archive',
      timeline: 'Timeline',
      menu: 'Menu',
      close: 'Close',
    },
    hero: {
      title: 'ONE BLACK CAT.\nMANY MOODS.',
      disclosure: 'Cinematic portrait',
    },
    profile: {
      eyebrow: 'Profile · 01',
      title: 'He runs the house.',
      summary:
        'Nanami is a black cat with a red collar, a bent tail tip, and firm opinions about every room he enters.',
      born: 'Born',
      birthplace: 'Birthplace',
      birthplaceLocalization: {
        names: {
          Utsunomiya: 'Utsunomiya',
          Tochigi: 'Tochigi',
          Japan: 'Japan',
        },
        order: ['city', 'region', 'country'],
        separator: ', ',
      },
      sex: 'Sex',
      male: 'Male',
      age: 'Age',
      formatAge: (age) => `${age} years old`,
      formatBirthDate: (birthDate) => formatProfileDate('en', birthDate),
      room: 'His room',
      roomCaption: 'Nanami at home, keeping watch over his territory.',
    },
    notes: {
      eyebrow: 'Field Notes · 03',
      title: 'Ways to recognize Nanami.',
      observed: 'Observed',
      ownerConfirmed: 'Owner confirmed',
      eyes: {
        term: 'Yellow-green eyes',
        detail: 'Bright, watchful, and hard to ignore.',
        observation: 'His gaze follows movement across the room.',
      },
      tail: {
        term: 'Right-angle tail',
        detail: 'The tip bends into his unmistakable signature.',
        observation: 'The bend remains visible whether he sits or walks.',
      },
      collar: {
        term: 'Red collar',
        detail: 'A clear flash of red against his short black coat.',
        observation: 'He wears it without a dangling tag.',
      },
      doors: {
        term: 'Zero closed doors',
        detail: 'Every room falls within his inspection route.',
        observation: 'A closed door is treated as a personal challenge.',
      },
    },
    archive: {
      all: 'All',
      photos: 'Photos',
      memes: 'Memes',
      portraits: 'Portraits',
      title: 'Mood Archive',
      eyebrow: 'Mood Archive · 04',
      summary: 'Everyday photographs, expressions, and jokes from his ongoing life.',
      filterLabel: 'Filter archive',
      ribbonLabel: 'Collection',
      emptyTitle: 'Nothing here yet',
      empty: 'Nanami has not added anything to this collection yet.',
      filterEmpty: 'No entries match this filter.',
      missingDate: 'Date not recorded',
      imageUnavailable: 'Image unavailable',
      imageUnavailableNote: 'The original image could not be displayed.',
      view: 'View',
      close: 'Close',
      previous: 'Previous',
      next: 'Next',
      photo: 'Photo',
      meme: 'Meme',
      date: 'Date',
      location: 'Location',
      story: 'Story',
    },
    living: {
      eyebrow: 'Living Archive · 05',
      title: 'His story is still unfolding.',
      summary: 'A growing record of Nanami as he explores, observes, and runs the house.',
      born: 'Born',
      currentAge: 'Current age',
      latestCapture: 'Latest capture',
      collectionDescriptions: {
        photos: 'Everyday scenes from Nanami’s territory.',
        memes: 'His expressions, translated into jokes.',
        portraits: 'A closer look at his face and character.',
      },
    },
    closing: {
      eyebrow: 'To Be Continued · 06',
      title: 'Nanami is probably watching you.',
      returnLink: 'Return to his territory',
    },
  },
  'zh-CN': {
    nav: {
      home: '首页',
      profile: '资料',
      notes: '观察笔记',
      archive: '档案',
      timeline: '时间线',
      menu: '菜单',
      close: '关闭',
    },
    hero: {
      title: '一只黑猫。\n无数种表情。',
      disclosure: '艺术化肖像',
    },
    profile: {
      eyebrow: '个人档案 · 01',
      title: '这个家归他管。',
      summary: 'Nanami 是一只戴红项圈的黑猫，尾巴尖弯成直角，对家里的每个房间都很有主见。',
      born: '出生日期',
      birthplace: '出生地',
      birthplaceLocalization: {
        names: {
          Utsunomiya: '宇都宫市',
          Tochigi: '栃木县',
          Japan: '日本',
        },
        order: ['country', 'region', 'city'],
        separator: '',
      },
      sex: '性别',
      male: '男',
      age: '年龄',
      formatAge: (age) => `${age}岁`,
      formatBirthDate: (birthDate) => formatProfileDate('zh-CN', birthDate),
      room: '他的房间',
      roomCaption: 'Nanami 在家中巡视自己的领地。',
    },
    notes: {
      eyebrow: '观察笔记 · 03',
      title: '如何认出 Nanami。',
      observed: '观察记录',
      ownerConfirmed: '主人确认',
      eyes: {
        term: '黄绿色眼睛',
        detail: '明亮、警觉，让人无法忽视。',
        observation: '房间里一有动静，他的目光就会跟过去。',
      },
      tail: {
        term: '直角尾巴',
        detail: '尾巴尖的弯折是他独一无二的标志。',
        observation: '无论坐着还是走动，都能看到这个弯角。',
      },
      collar: {
        term: '红色项圈',
        detail: '一抹鲜红衬着他的黑色短毛。',
        observation: '他戴着项圈，但没有悬挂多余的牌子。',
      },
      doors: {
        term: '不许关门',
        detail: '每个房间都在他的巡视范围内。',
        observation: '遇到关着的门，他会把它当成一项挑战。',
      },
    },
    archive: {
      all: '全部',
      photos: '照片',
      memes: '表情包',
      portraits: '肖像',
      title: '表情档案',
      eyebrow: '表情档案 · 04',
      summary: '收录他生活中不断增加的日常照片、神态与趣味瞬间。',
      filterLabel: '筛选档案',
      ribbonLabel: '收藏类别',
      emptyTitle: '这里暂时没有内容',
      empty: 'Nanami 还没有为这个收藏添加内容。',
      filterEmpty: '没有符合当前筛选条件的记录。',
      missingDate: '日期未记录',
      imageUnavailable: '图片暂不可用',
      imageUnavailableNote: '原始图片目前无法显示。',
      view: '查看',
      close: '关闭',
      previous: '上一张',
      next: '下一张',
      photo: '照片',
      meme: '表情包',
      date: '日期',
      location: '地点',
      story: '故事',
    },
    living: {
      eyebrow: '生活档案 · 05',
      title: '他的故事还在继续。',
      summary: '记录 Nanami 探索、观察并管理这个家的每一天，内容还会不断增加。',
      born: '出生日期',
      currentAge: '当前年龄',
      latestCapture: '最近拍摄',
      collectionDescriptions: {
        photos: 'Nanami 在自己领地里的日常片段。',
        memes: '把他的神态变成好笑的瞬间。',
        portraits: '近距离看看他的面孔与性格。',
      },
    },
    closing: {
      eyebrow: '未完待续 · 06',
      title: 'Nanami 可能正在看着你。',
      returnLink: '回到他的领地',
    },
  },
}
