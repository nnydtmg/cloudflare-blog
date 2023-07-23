---
title: "AWS CDKで毎日の料金をSlackに通知する機能を実装してみた"
date: "2022/12/28"
description: "AWS CDKで毎日の料金をSlackに通知する機能を実装してみた。"
topics: ["AWS","CDK","Cost","Slack","python"]
---

# やりたいこと

AWSの利用料は予算管理をしていても、予算の指定したパーセンテージに達するか、請求が確定するまでデフォルトでは通知ができません。
消し忘れのリソースについては1日でも早く気が付きたいです。
そのためには毎日コスト状況を確認する事が大事です。

ということで、毎日Slackに利用料を通知する仕組みを作ってみようと思います。
この手の話は沢山の方が記事にされているので、そこまで新規性はないですが、やったことメモ的な感じで残しておきます。

また、せっかくなのでCDKを使ってLambdaまで構築してみようと思います。
CDKはTypescript、Lambdaはpythonで作成してますが、個人的な趣味なので、気になる方は書き換えてください！


# 環境

構築環境はこちらです。

* WSL2上のUbuntu22.04
* node : v18.12.1
* CDK  : 2.54.0 (TypeScript)
* AWS東京リージョン
* Lambda:Python3.9


# 構築

## Slackチャンネル設定

SlackでWebHookを受けられるように設定を行います。

通知したいチャンネルを作成し、チャンネルの設定から、「アプリを追加する」を選択し、「Appディレクトリを表示」をクリックすると、ブラウザにSlackのアプリ設定画面が開きます。

![アプリを追加する](https://storage.googleapis.com/zenn-user-upload/e67f37bdc70f-20230307.png)


![Appディレクトリを表示](https://storage.googleapis.com/zenn-user-upload/3f6568f34410-20230307.png)


![アプリのビルド](https://storage.googleapis.com/zenn-user-upload/223c6a6deb4c-20230307.png)


Create AppからNameSpace等を設定し、Webhookの許可を行います。


![アプリの作成](https://storage.googleapis.com/zenn-user-upload/07a1625d3aa9-20230307.png)


![スクラッチで作成](https://storage.googleapis.com/zenn-user-upload/bace09e5bd4c-20230307.png)


![各種設定](https://storage.googleapis.com/zenn-user-upload/df74abb2cc10-20230307.png)


「Add New Webhook to Workspace」をクリックすると、チャンネル用のURLが表示されますので、コピーしておきます。

![Webhook有効化](https://storage.googleapis.com/zenn-user-upload/92c25cc1356c-20230307.png)


![URL発行](https://storage.googleapis.com/zenn-user-upload/2a84421a9e24-20230307.png)


## CDKプロジェクト作成

基本的な構築手順はAWSの[公式入門手順](https://aws.amazon.com/jp/getting-started/guides/setup-cdk/module-three/)等を参考に、initします。

スタック名は今回、`AwsCostalertSlackappStack` という名前で作成しています。


## Lambda作成

「lambda」というディレクトリに「app.py」を作成していきます。

```python:app.py
# lambda/app.py

# encoding: utf-8
import json
import datetime
import requests
import boto3
import os
import logging

TODAY = datetime.datetime.utcnow()
FIRST_DAY_OF_THE_MONTH = TODAY - datetime.timedelta(days=TODAY.day - 1)
START_DATE = FIRST_DAY_OF_THE_MONTH.strftime('%Y/%m/%d').replace('/', '-')
END_DATE = TODAY.strftime('%Y/%m/%d').replace('/', '-')

SLACK_POST_URL = os.environ['SLACK_POST_URL']
SLACK_CHANNEL = os.environ['SLACK_CHANNEL']

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client = boto3.client('ce')
sts = boto3.client('sts')
id_info = sts.get_caller_identity()

def get_total_cost():
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': START_DATE,
            'End': END_DATE
        },
        Granularity='MONTHLY',
        Metrics=[
            'UnblendedCost',
        ],
    )

    total_cost = response["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"]
    return total_cost

def handler(event, context):
    text = "ID:{} の {}までのAWS合計料金 : ${}".format(id_info['Account'], END_DATE, get_total_cost())
    content = {"text": text}

    slack_message = {
        'channel': SLACK_CHANNEL,
        "attachments": [content],
    }

    try:
        requests.post(SLACK_POST_URL, data=json.dumps(slack_message))
    except requests.exceptions.RequestException as e:
        logger.error("Request failed: %s", e)
```

少しだけコードの解説をすると、cost-usageレポートの開始日と終了日を変数で定義し、それをもとにtotal_cost関数を実行しています。
Slackの設定はスタックで設定しているパラメータを参照するようになっています。


## Lambda Layer作成

requestsモジュールを使うために、Lambda Layerを作ります。
boto3も必要があればインストールします。

```
mkdir lambda_layer  && cd lambda_layer

mkdir python
pip install -t python requests boto3
```


## CDKスタック作成

CDKのスタックを更新します。

```ts:aws-costalert-slackapp-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from "aws-cdk-lib/aws-events";
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AwsCostalertSlackappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // lambda-layer
    const layer = new lambda.LayerVersion(this, 'MyLayer', {
      code: lambda.Code.fromAsset("lambda_layer"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
    });
    
    // lambda
    const sampleLambda = new lambda.Function(this, 'NptifyPriceHandler', {
      runtime: lambda.Runtime.PYTHON_3_9,    // execution environment
      code: lambda.Code.fromAsset('lambda'),  // code loaded from "lambda" directory
      handler: 'app.handler',                // file is "hello", function is "handler"
      environment: {
        TZ: 'Asia/Tokyo',
        SLACK_POST_URL: 'コピーしたURL',
        SLACK_CHANNEL: '送信先チャンネル',
      },
      layers: [layer],
      initialPolicy: [new iam.PolicyStatement({
        actions: ['ce:GetCostAndUsage'],
        resources: ['*'],
      })],
    });

    // EventBridge
    new events.Rule(this, "sampleRule", {
      // JST で毎日 AM9:10 に定期実行
      // 参考 https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/events/ScheduledEvents.html#CronExpressions
      schedule: events.Schedule.cron({minute: "10", hour: "0"}),
      targets: [new targets.LambdaFunction(sampleLambda, {retryAttempts: 3})],
  });
  }
}
```
先ほどのLambda_LayerとLambda、スケジュール実行するためのEventbridgeを定義しています。
細かいパラメータの説明は今回省かせていただきます。

lambdaコンストラクトを利用するため、以下コマンドでインストールします。

```
npm install aws-cdk-lib/aws-lambda
```

## CDKデプロイ

アカウント内で構築するリージョンで初回実行の方はbootstrapが必要になります。

```
cdk bootstrap
```

作成したスタックをデプロイしてみましょう。

```
cdk deploy
```

正常に終了後、マネジメントコンソールでCloudFormationを確認してみましょう。
スタックが作成されているはずです。
後は実行されるまで待ちます。


## 実行確認

設定時刻にSlackを見てみると、、うまく実行されてますね！
料金はちょっと特殊な表示になってますが、あまり利用していないアカウントなのでそもそも利用料がないです。（面白味がないですね）

|![実行確認](https://storage.googleapis.com/zenn-user-upload/8d5f0999125f-20230307.png)|
|:--|


# 改善

このままでも問題ないですが、よりセキュアに定義してみましょう。
どこかというと、スタック内でLambdaを定義する部分のパラメータをParameterStoreから参照出来るようにします。

```ts:aws-costalert-slackapp-stack.ts
      environment: {
        TZ: 'Asia/Tokyo',
        SLACK_POST_URL: 'コピーしたURL',
        SLACK_CHANNEL: '送信先チャンネル',
      },
```
ParameterStore自体は手動で作成します。
ParameterStoreをコードで作成してしまうと、結局クレデンシャルが残るのであまり好きではありませんし、適切ではないと思います。

また、せっかくなのでSecretsManagerも利用してURLの取得はそちらから行いたいと思います。
何のためかと言われると、普段コードを書く仕事をしていないので、この機会にチャレンジしてみようという、ただそれだけです！


## ParameterStore作成

ParamaterStoreの作成は特に変わったことをするわけではないので、作成手順は割愛します。
型はString型で登録しています。SecureStringでも良いですが、その場合は、メソッドが変わるのでご注意ください。


## Stack内でParameterStoreの値を参照する

先ほど作成したパラメータストアをスタックから参照します。

```ts:aws-costalert-slackapp-stack.ts
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class AwsCostalertSlackappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Parameter
    const slackChannel = StringParameter.valueForStringParameter(this, 'ParameterStore key');
```
コードとしては1行足すだけです。簡単ですね。
今回は `string` 型で登録しているので、valueForStringParameterメソッドを利用します。


## SecretsManager作成

URLはSecretsManagerに登録してみます。
こちらも手順は省きますが、とりあえず登録してみました。


## Lambda関数内でSecretsManagerの値を取得する

SecretsManagerに登録した値はスタックから参照すると、SecureStringとなってスタック内で型変換等が必要になるので、Lambdaが参照するようにしてみます。
Lambdaが起動するたびにSecretsManagerへのアクセスが発生するので、気になる方はParamaterStoreでcdk deployの時に取得する方法で十分かと思います。

SecretsManagerに値を登録すると、参考のコードが出てくるので、それをもとにします。
また、LambdaがSecretsManagerに読み込みが出来るようIAMロールに権限が必要ですので、適宜付けてください。

```python:app.py
from botocore.exceptions import ClientError

def get_secret():

    secret_name = "SecretsManagerのシークレット名"
    region_name = "ap-northeast-1"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    # Decrypts secret using the associated KMS key.
    secret = get_secret_value_response['SecretString']
    return secret
```
最後の2行だけ足しています。ここでは`SecretString`を返しているので、hondlerの方で`ast`を使って辞書型に変換します。

```python:app.py
import ast
def handler(event, context):
  secret = ast.literal_eval(get_secret())
  SLACK_POST_URL = secret['SecretsManagerのキー']
```

## 再デプロイ

再度デプロイして実行されるのを待ちます。
待つのが嫌な人は近い時間に設定してデプロイしましょう。


## 実行確認

問題なく実行されました！
これでパラメータは別としたちょっとセキュア？なスタックを作成することが出来ました。

|![再実行確認](https://storage.googleapis.com/zenn-user-upload/5196f3ba20ec-20230308.png)|
|:--|

# 最後に

コスト管理はAWSを利用する上でIAMと同じくらい大事なので、出来れば最初に設定しておきたいですね。
Slackだけでなく、LINEに通知する記事も出ていたりするので、好みに合った通知方法を設定しておくことをおすすめします。
こまめに見るし、リソースは削除しているから大丈夫という方も、朝起きてびっくり！という事態を防ぐためにも、ぜひ導入しておきましょう！

最後まで呼んでいただいてありがとうございました！

コードはこちらにおいています。

https://github.com/nnydtmg/aws-costalert-slackapp



