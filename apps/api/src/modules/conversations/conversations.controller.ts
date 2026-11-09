import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { ConversationService } from './conversation.service';
import {
  ConversationDetailDto,
  ConversationDto,
  ConversationListResponseDto,
  CreateConversationRequestDto,
} from './dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations, most recently active first' })
  @ApiOkResponse({ type: ConversationListResponseDto })
  @ZodSerializerDto(ConversationListResponseDto)
  async list(): Promise<ConversationListResponseDto> {
    return { conversations: await this.service.list() };
  }

  @Post()
  @ApiOperation({ summary: 'Start a new conversation' })
  @ApiOkResponse({ type: ConversationDto })
  @ZodSerializerDto(ConversationDto)
  create(@Body() body: CreateConversationRequestDto): Promise<ConversationDto> {
    return this.service.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Conversation with its full transcript, sources and agent traces' })
  @ApiOkResponse({ type: ConversationDetailDto })
  @ZodSerializerDto(ConversationDetailDto)
  get(@Param('id') id: string): Promise<ConversationDetailDto> {
    return this.service.getDetail(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }
}
