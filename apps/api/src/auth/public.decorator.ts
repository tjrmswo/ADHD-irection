import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** 로그인 없이 열어 두는 라우트에 붙인다 (기본은 전부 인증 필요). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
