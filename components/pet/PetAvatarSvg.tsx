'use client';

import React from 'react';
import { defaultAvatar, validateAvatar } from '@/lib/avatar/profile';
import type { PetRegion } from '@/lib/interaction/regions';
import type {
  AvatarProfile,
  Behavior,
  InteractionOverlay,
  PetType,
} from '@/lib/types';

export interface PetAvatarSvgProps {
  avatar?: AvatarProfile | null;
  fallbackType?: PetType;
  realityBehavior: Behavior;
  displayAnimation?: string;
  overlay: InteractionOverlay | null;
  onPartPointerDown?: (
    part: PetRegion,
    e: React.PointerEvent<SVGElement>
  ) => void;
}

export function PetAvatarSvg({
  avatar,
  fallbackType = 'cat',
  realityBehavior,
  displayAnimation,
  overlay,
  onPartPointerDown,
}: PetAvatarSvgProps) {
  const safeAvatar = validateAvatar(avatar) ?? defaultAvatar(fallbackType);
  const isCat = safeAvatar.species === 'cat';
  const isPointedEar = safeAvatar.earShape === 'pointed';

  const activePose = displayAnimation ?? realityStatePose(realityBehavior);
  const isSleeping =
    activePose === 'sleeping' || activePose === 'sleeping_twitch';
  const isEating = activePose === 'eating';
  const isPlaying = activePose === 'playing';
  const isWalking = activePose === 'walking';

  const activeReaction = overlay && overlay.level > 0 ? overlay.kind : null;
  const isMildReaction = Boolean(overlay && overlay.level <= 1);

  // 眼睛状态：熟睡闭眼、被摸头/顺背幸福弯眼、点鼻好奇圆眼
  const eyesHappyClosed =
    !isSleeping &&
    !isMildReaction &&
    (activeReaction === 'tap_head' || activeReaction === 'stroke');
  const eyesSurprised =
    !isSleeping && !isMildReaction && activeReaction === 'tap_nose';
  const tailFast =
    !isSleeping &&
    (activeReaction === 'tap_tail' ||
      activeReaction === 'stroke' ||
      isPlaying ||
      isWalking);

  const bindPart = (part: PetRegion) => ({
    'data-part': part,
    className: 'pet-part-hit pointer-events-auto',
    onPointerDown: (e: React.PointerEvent<SVGElement>) => {
      if (onPartPointerDown) {
        onPartPointerDown(part, e);
      }
    },
  });

  return (
    <svg
      viewBox="0 0 280 280"
      className="w-full h-full overflow-visible select-none pointer-events-none"
      role="img"
      aria-label={`${isCat ? '猫咪' : '狗狗'}数字分身角色（可点击头、鼻、背、尾互动）`}
    >
      <defs>
        {/* 柔和绘本毛色立体渐变 */}
        <radialGradient id="coatGrad" cx="42%" cy="32%" r="68%">
          <stop offset="0%" stopColor={safeAvatar.coatColor} stopOpacity="1" />
          <stop offset="72%" stopColor={safeAvatar.coatColor} stopOpacity="1" />
          <stop
            offset="100%"
            stopColor={safeAvatar.patchColor}
            stopOpacity="0.48"
          />
        </radialGradient>

        <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            stopColor={safeAvatar.muzzleColor}
            stopOpacity="0.96"
          />
          <stop
            offset="100%"
            stopColor={safeAvatar.coatColor}
            stopOpacity="0.32"
          />
        </linearGradient>

        <radialGradient id="cheekBlush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59B92" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F59B92" stopOpacity="0" />
        </radialGradient>

        <filter
          id="softDropShadow"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
        >
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="5"
            floodColor="#3D2B1F"
            floodOpacity="0.16"
          />
        </filter>
      </defs>

      {/* ==================== 1. 尾巴层 (data-part="tail") ==================== */}
      <g
        {...bindPart('tail')}
        className={`pet-part-hit ${
          isSleeping
            ? ''
            : tailFast
              ? 'rig-tail-wag-fast'
              : 'rig-tail-idle'
        }`}
      >
        {/* 透明热区扩充（确保手指容易点中尾巴，>=56px） */}
        <circle cx="218" cy="182" r="38" fill="transparent" />

        {isCat ? (
          /* 猫咪主角：优雅蓬松 S 型长尾 + 奶油色或斑纹尾尖 */
          <g filter="url(#softDropShadow)">
            <path
              d="M 178 214 C 218 214, 248 182, 240 138 C 235 112, 212 114, 214 136 C 216 164, 200 188, 174 196 Z"
              fill={safeAvatar.coatColor}
              stroke={safeAvatar.patchColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* 猫咪尾尖柔光拼色 */}
            <path
              d="M 240 138 C 235 112, 212 114, 214 136 C 222 142, 234 144, 240 138 Z"
              fill={
                safeAvatar.pattern === 'tuxedo'
                  ? safeAvatar.muzzleColor
                  : safeAvatar.patchColor
              }
            />
          </g>
        ) : (
          /* 狗狗蓬松上扬绘本尾（带奶油尾尖） */
          <g filter="url(#softDropShadow)">
            <path
              d="M 180 202 C 216 196, 240 166, 228 142 C 220 128, 198 142, 192 168 C 186 184, 178 190, 174 196 Z"
              fill={safeAvatar.coatColor}
            />
            <path
              d="M 228 142 C 222 131, 208 136, 202 150 C 212 154, 222 150, 228 142 Z"
              fill={safeAvatar.muzzleColor}
            />
          </g>
        )}
      </g>

      {/* ==================== 2. 身体与后背层 (data-part="body") ==================== */}
      <g {...bindPart('body')} filter="url(#softDropShadow)">
        {/* 身体主轮廓（猫咪梨形柔顺坐姿 / 熟睡团子卧姿） */}
        <ellipse
          cx="140"
          cy={isSleeping ? '198' : '188'}
          rx={isSleeping ? '66' : isCat ? '54' : '58'}
          ry={isSleeping ? '44' : '54'}
          fill="url(#coatGrad)"
        />
        <ellipse
          cx="140"
          cy={isSleeping ? '198' : '188'}
          rx={isSleeping ? '66' : isCat ? '54' : '58'}
          ry={isSleeping ? '44' : '54'}
          fill={safeAvatar.coatColor}
          fillOpacity="0.88"
        />

        {/* 花色图案：tuxedo 燕尾服胸白 / spotted 暖斑点 */}
        {safeAvatar.pattern === 'tuxedo' && (
          <ellipse
            cx="140"
            cy={isSleeping ? '198' : '192'}
            rx="34"
            ry={isSleeping ? '28' : '38'}
            fill={safeAvatar.muzzleColor}
          />
        )}
        {safeAvatar.pattern === 'spotted' && (
          <g fill={safeAvatar.patchColor} opacity="0.72">
            <ellipse
              cx="106"
              cy="176"
              rx="14"
              ry="10"
              transform="rotate(-18 106 176)"
            />
            <ellipse
              cx="174"
              cy="184"
              rx="16"
              ry="11"
              transform="rotate(22 174 184)"
            />
            <circle cx="156" cy="158" r="8" />
          </g>
        )}

        {/* 柔和胸口蓬松毛领与肚皮高光 */}
        {safeAvatar.pattern !== 'tuxedo' && (
          <ellipse
            cx="140"
            cy={isSleeping ? '204' : '194'}
            rx="30"
            ry={isSleeping ? '22' : '32'}
            fill="url(#bellyGrad)"
            opacity="0.82"
          />
        )}

        {/* 专属项圈与温暖金铃铛 */}
        <path
          d="M 102 148 Q 140 163 178 148"
          fill="none"
          stroke={safeAvatar.collarColor}
          strokeWidth="8.5"
          strokeLinecap="round"
        />
        <circle
          cx="140"
          cy="158"
          r="7.5"
          fill="#F6C96B"
          stroke="#C9933B"
          strokeWidth="2"
        />
        <circle cx="138" cy="156" r="2" fill="#FFF8E7" />

        {/* 温顺山竹前爪 */}
        <g>
          <ellipse
            cx="114"
            cy="232"
            rx="15.5"
            ry="10.5"
            fill={safeAvatar.muzzleColor}
            stroke={safeAvatar.coatColor}
            strokeWidth="2.2"
          />
          <ellipse
            cx="166"
            cy="232"
            rx="15.5"
            ry="10.5"
            fill={safeAvatar.muzzleColor}
            stroke={safeAvatar.coatColor}
            strokeWidth="2.2"
          />
          <path
            d="M 109 235 v 4.5 M 119 235 v 4.5 M 161 235 v 4.5 M 171 235 v 4.5"
            stroke="#B38B73"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* 进食状态时面前浮现的小食盆 */}
      {isEating && (
        <g transform="translate(0, 6)">
          <ellipse cx="140" cy="248" rx="34" ry="8" fill="#D9CFC3" />
          <path
            d="M 110 236 L 170 236 L 162 248 L 118 248 Z"
            fill="#E07A5F"
          />
          <ellipse cx="140" cy="236" rx="30" ry="6" fill="#F4A261" />
          <circle cx="132" cy="235" r="3.5" fill="#8D5B4C" />
          <circle cx="142" cy="236" r="3.5" fill="#8D5B4C" />
          <circle cx="149" cy="234" r="3.5" fill="#8D5B4C" />
        </g>
      )}

      {/* ==================== 3. 头部与耳朵层 (data-part="head") ==================== */}
      <g
        {...bindPart('head')}
        className={`pet-part-hit ${isEating ? 'rig-head-eat' : ''}`}
        filter="url(#softDropShadow)"
      >
        {/* 左耳（猫咪饱满三角尖耳 + 粉嫩内耳绒毛 / 折耳或垂耳兼容） */}
        <g className={isSleeping ? '' : 'rig-ear-left'}>
          {isPointedEar ? (
            <g>
              <path
                d="M 78 96 C 68 68, 64 38, 72 30 C 80 24, 106 46, 124 68 Z"
                fill={safeAvatar.patchColor}
              />
              <path
                d="M 84 88 C 76 68, 74 46, 79 40 C 85 37, 102 52, 114 70 Z"
                fill="#F4B6B0"
                opacity="0.85"
              />
              {/* 耳廓内侧白色绒毛线 */}
              <path
                d="M 84 82 Q 94 74 106 74"
                stroke={safeAvatar.muzzleColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.8"
              />
            </g>
          ) : (
            <path
              d="M 88 74 C 60 72, 48 106, 56 136 C 62 154, 82 150, 88 128 Z"
              fill={safeAvatar.patchColor}
            />
          )}
        </g>

        {/* 右耳 */}
        <g className={isSleeping ? '' : 'rig-ear-right'}>
          {isPointedEar ? (
            <g>
              <path
                d="M 202 96 C 212 68, 216 38, 208 30 C 200 24, 174 46, 156 68 Z"
                fill={safeAvatar.patchColor}
              />
              <path
                d="M 196 88 C 204 68, 206 46, 201 40 C 195 37, 178 52, 166 70 Z"
                fill="#F4B6B0"
                opacity="0.85"
              />
              <path
                d="M 196 82 Q 186 74 174 74"
                stroke={safeAvatar.muzzleColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.8"
              />
            </g>
          ) : (
            <path
              d="M 192 74 C 220 72, 232 106, 224 136 C 218 154, 198 150, 192 128 Z"
              fill={safeAvatar.patchColor}
            />
          )}
        </g>

        {/* 圆润脸庞主体（猫咪带可爱婴儿肥腮帮） */}
        <ellipse
          cx="140"
          cy="105"
          rx={isCat ? '64' : '61'}
          ry="54"
          fill={safeAvatar.coatColor}
        />

        {/* 猫咪经典额头虎斑 M 纹或花色斑块 */}
        {isCat && safeAvatar.pattern !== 'tuxedo' && (
          <path
            d="M 122 68 L 130 58 L 140 67 L 150 58 L 158 68"
            fill="none"
            stroke={safeAvatar.patchColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.65"
          />
        )}
        {safeAvatar.pattern === 'spotted' && (
          <ellipse
            cx="108"
            cy="95"
            rx="21"
            ry="19"
            fill={safeAvatar.patchColor}
            opacity="0.76"
            transform="rotate(-12 108 95)"
          />
        )}
        {safeAvatar.pattern === 'tuxedo' && (
          <path
            d="M 140 62 L 116 126 L 164 126 Z"
            fill={safeAvatar.muzzleColor}
            opacity="0.94"
          />
        )}

        {/* 头顶呆毛绒毛细节 */}
        <path
          d="M 133 52 Q 140 42 146 51 Q 152 44 154 53"
          fill="none"
          stroke={safeAvatar.coatColor}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 脸颊暖红晕 */}
        <ellipse cx="94" cy="116" rx="15" ry="8.5" fill="url(#cheekBlush)" />
        <ellipse cx="186" cy="116" rx="15" ry="8.5" fill="url(#cheekBlush)" />

        {/* 双眼层（猫咪宝石大眼 + 双高光） */}
        <g className={isSleeping || eyesHappyClosed ? '' : 'rig-eyes-blink'}>
          {isSleeping ? (
            /* 熟睡安详闭眼弧线 */
            <g
              fill="none"
              stroke="#3B2F2A"
              strokeWidth="3.5"
              strokeLinecap="round"
            >
              <path d="M 99 102 Q 110 111 121 102" />
              <path d="M 159 102 Q 170 111 181 102" />
            </g>
          ) : eyesHappyClosed ? (
            /* 摸头/顺背时的幸福笑眼 ^ ^ */
            <g
              fill="none"
              stroke="#3B2F2A"
              strokeWidth="3.8"
              strokeLinecap="round"
            >
              <path d="M 99 105 Q 110 92 121 105" />
              <path d="M 159 105 Q 170 92 181 105" />
            </g>
          ) : (
            /* 明亮水润绘本宝石大眼 */
            <g>
              {/* 左眼 */}
              <circle
                cx="110"
                cy="100"
                r={eyesSurprised ? '13.2' : isCat ? '12.2' : '10.6'}
                fill={safeAvatar.eyeColor}
              />
              <ellipse
                cx="110"
                cy="100"
                rx={eyesSurprised ? '7.5' : isCat ? '5.5' : '6'}
                ry={eyesSurprised ? '8.5' : '7.8'}
                fill="#231B18"
              />
              <circle cx="105.5" cy="95.5" r="4" fill="#FFFFFF" />
              <circle
                cx="114"
                cy="103.5"
                r="1.8"
                fill="#FFFFFF"
                opacity="0.88"
              />

              {/* 右眼 */}
              <circle
                cx="170"
                cy="100"
                r={eyesSurprised ? '13.2' : isCat ? '12.2' : '10.6'}
                fill={safeAvatar.eyeColor}
              />
              <ellipse
                cx="170"
                cy="100"
                rx={eyesSurprised ? '7.5' : isCat ? '5.5' : '6'}
                ry={eyesSurprised ? '8.5' : '7.8'}
                fill="#231B18"
              />
              <circle cx="165.5" cy="95.5" r="4" fill="#FFFFFF" />
              <circle
                cx="174"
                cy="103.5"
                r="1.8"
                fill="#FFFFFF"
                opacity="0.88"
              />
            </g>
          )}
        </g>

        {/* 猫咪灵动胡须 */}
        {isCat && (
          <g
            stroke="#8C7365"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.62"
          >
            <line x1="66" y1="110" x2="90" y2="114" />
            <line x1="64" y1="120" x2="89" y2="120" />
            <line x1="68" y1="129" x2="91" y2="126" />
            <line x1="214" y1="110" x2="190" y2="114" />
            <line x1="216" y1="120" x2="191" y2="120" />
            <line x1="212" y1="129" x2="189" y2="126" />
          </g>
        )}
      </g>

      {/* ==================== 4. 口鼻吻部独立触控层 (data-part="nose") ==================== */}
      <g {...bindPart('nose')}>
        {/* 扩大鼻尖可触控透明圆（直径 >= 56px） */}
        <circle cx="140" cy="118" r="28" fill="transparent" />

        {/* 柔和奶油色猫咪花生吻部垫 */}
        <ellipse
          cx="140"
          cy="119"
          rx="22"
          ry="15"
          fill={safeAvatar.muzzleColor}
        />

        {/* 粉嫩倒三角猫鼻 / 湿润狗鼻头 */}
        {isCat ? (
          <path
            d="M 133 111 Q 140 108 147 111 L 142 118.5 Q 140 120.5 138 118.5 Z"
            fill="#E58282"
          />
        ) : (
          <ellipse
            cx="140"
            cy="113"
            rx="8.5"
            ry="6"
            fill="#3B2F2A"
          />
        )}
        {/* 鼻尖高光 */}
        <ellipse
          cx="138"
          cy="111"
          rx="2.6"
          ry="1.4"
          fill="#FFFFFF"
          opacity="0.7"
        />

        {/* ω 猫咪微笑嘴线与粉色小舌头 */}
        <path
          d="M 140 118.5 L 140 122.5 M 130.5 123 Q 135.2 128.5 140 123 Q 144.8 128.5 149.5 123"
          fill="none"
          stroke="#4A3A32"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {!isSleeping &&
          (isPlaying ||
            activeReaction === 'tap_head' ||
            activeReaction === 'tap_tail') && (
            <path d="M 136.5 125.5 Q 140 133.5 143.5 125.5 Z" fill="#F28482" />
          )}
      </g>

      {/* ==================== 5. 互动反馈飘浮小心心粒子 ==================== */}
      {activeReaction && !isMildReaction && (
        <g
          className="heart-float pointer-events-none"
          transform="translate(184, 52)"
        >
          <path
            d="M12 21s-7-4.5-9.5-8.5C.5 9 2.5 5 6.5 5c2.3 0 4 1.3 5.5 3 1.5-1.7 3.2-3 5.5-3 4 0 6 4 4 7.5C19 16.5 12 21 12 21z"
            fill="#E07A5F"
          />
        </g>
      )}
    </svg>
  );
}

function realityStatePose(behavior: Behavior): string {
  return behavior === 'unknown' ? 'idle' : behavior;
}
