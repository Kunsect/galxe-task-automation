import { readFileToArray, waittingBetween } from '../utils/common'
import curl from '../requests/curl'
import logger from '../logger'
import 'dotenv/config'

const BASE_URL = 'https://twitter.com'

export class Twitter {
  headers: string[]
  authToken: string = ''
  initted: boolean = false

  constructor(pathIndex: number) {
    const needTwitter = Number(process.env.NEED_TWITTER) === 1
    if (needTwitter) {
      const twitterAccounts = readFileToArray('twitter.txt')

      if (twitterAccounts.length) {
        this.authToken = twitterAccounts[pathIndex]

        logger.info(`the twitter auth token is ${this.authToken}`)
      }
    }

    this.headers = [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      `Cookie: auth_token=${this.authToken}`
    ]
  }

  private async request(queryId: string, action: string, body: object): Promise<any> {
    if (!this.initted) await this.getCt0()

    logger.debug(`[twitter] requesting ${action}.`)

    const headers = [...this.headers, 'Content-Type: application/json']

    const res = await curl.post(`${BASE_URL}/i/api/graphql/${queryId}/${action}`, body, headers)

    await waittingBetween(3000, 4500)

    // 327, 139: already
    const errorCode = res.data.errors && res.data.errors[0].code
    const alreadyCode = [139, 327]

    if (!errorCode) {
      logger.info(`[twitter] ${action} completed.`)

      return res
    }

    if (alreadyCode.includes(errorCode)) {
      logger.warn(`[twitter] already, code: ${errorCode} - ${res.data.errors[0].message}`)

      return true
    }

    throw {
      code: res.data.errors[0].code,
      data: res.data.errors[0],
      message: `[twitter] request ${action} error, info: ${JSON.stringify(res.data.errors)}`,
      extra: this.authToken
    }
  }

  async getCt0() {
    const res = await curl.get(`${BASE_URL}/home`, this.headers, true)

    const cookies = res.headers[1]['Set-Cookie']
    const userCookie = cookies.find((cookie: string) => cookie.startsWith('ct0='))

    const ct0 = userCookie.split(';')[0].split('=')[1]

    if (!ct0) {
      throw {
        code: 1000,
        message: `ct0 not found - auth token: ${this.authToken}`,
        extra: this.authToken
      }
    }

    this.initted = true
    this.headers = [
      ...this.headers.map((header) => {
        if (header.startsWith('Cookie:')) return `${header}; ct0=${ct0}`
        return header
      }),
      ...[
        'authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-twitter-active-user: yes',
        'x-twitter-client-language: en',
        `x-csrf-token: ${ct0}`,
        'x-twitter-auth-type: OAuth2Session'
      ]
    ]
  }

  async createBindTweet(gid: string): Promise<string> {
    if (!this.initted) await this.getCt0()

    const queryId = 'SoVnbfCycZ7fERGCwpZkYA'
    const action = 'CreateTweet'

    const payload = {
      variables: {
        tweet_text: `Verifying my Twitter account for my #GalxeID gid:${gid} @Galxe \n\n galxe.com/id `,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: []
      },
      features: {
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: false,
        tweet_awards_web_tipping_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_media_download_video_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      },
      queryId
    }

    const res = await this.request(queryId, action, payload)

    const data = res.data.data

    const result = data.create_tweet.tweet_results.result
    const restId = result.rest_id
    const screenName = result.core.user_results.result.legacy.screen_name

    return `${BASE_URL}/${screenName}/status/${restId}`
  }

  async likeTweet(id: string) {
    const queryId = 'lI07N6Otwv1PhnEgXILM7A'
    const action = 'FavoriteTweet'

    const payload = {
      variables: {
        tweet_id: id,
        dark_request: false
      },
      queryId
    }

    await this.request(queryId, action, payload)
  }

  async reTweet(id: string) {
    const queryId = 'ojPdsZsimiJrUGLR1sjUtA'
    const action = 'CreateRetweet'

    const payload = {
      variables: {
        tweet_id: id,
        dark_request: false
      },
      queryId
    }

    return await this.request(queryId, action, payload)
  }

  async createPost(text: string) {
    const queryId = 'SoVnbfCycZ7fERGCwpZkYA'
    const action = 'CreateTweet'

    const payload = {
      variables: {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: []
      },
      features: {
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: false,
        tweet_awards_web_tipping_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_media_download_video_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      },
      queryId
    }

    return await this.request(queryId, action, payload)
  }

  async follow(name: string) {
    if (!this.initted) await this.getCt0()

    // get user id
    const queryId = '9zwVLJ48lmVUk8u_Gh9DmA'
    const action = 'ProfileSpotlightsQuery'
    const queryParams = encodeURIComponent(JSON.stringify({ screen_name: name }))

    const userRes = await curl.get(
      `${BASE_URL}/i/api/graphql/${queryId}/${action}?variables=${queryParams}`,
      this.headers
    )
    const userId = userRes.data.data.user_result_by_screen_name.result.rest_id

    // follow
    const payload = {
      include_profile_interstitial_type: '1',
      include_blocking: '1',
      include_blocked_by: '1',
      include_followed_by: '1',
      include_want_retweets: '1',
      include_mute_edge: '1',
      include_can_dm: '1',
      include_can_media_tag: '1',
      include_ext_has_nft_avatar: '1',
      include_ext_is_blue_verified: '1',
      include_ext_verified_type: '1',
      include_ext_profile_image_shape: '1',
      skip_status: '1',
      user_id: userId
    }

    try {
      const headers = [...this.headers, 'Content-Type: application/x-www-form-urlencoded']

      await curl.post('https://twitter.com/i/api/1.1/friendships/create.json', payload, headers)

      logger.info('twitter follow success')
    } catch (err: any) {
      if (err.code === 139) {
        logger.warn(`[twitter] ${err.data.message}`)

        return true
      }

      throw err
    }

    return true
  }
}
