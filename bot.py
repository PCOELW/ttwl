"""TTWL Discord bot — PC + Legacy M-column NOTES in the original spreadsheet."""
import asyncio
import os
import re

import discord
from discord import app_commands
from dotenv import load_dotenv
from sheet_client import send_request

load_dotenv()


def required(name):
    value = os.getenv(name, '').strip()
    if not value or value.startswith('PASTE_'):
        raise SystemExit(f'[CONFIG] Set {name} in your .env file')
    return value


TOKEN = required('DISCORD_TOKEN')
GUILD_ID = int(required('GUILD_ID'))
ALLOWED_USER_ID = int(required('ALLOWED_USER_ID'))
GUILD = discord.Object(id=GUILD_ID)

victor = app_commands.Group(name='victor', description='Manage TTWL completed-wallhop usernames')
SECTIONS = [
    app_commands.Choice(name='PC Wallhops', value='pc'),
    app_commands.Choice(name='Legacy List', value='legacy'),
]


def permitted(interaction: discord.Interaction) -> bool:
    return interaction.guild_id == GUILD_ID and interaction.user.id == ALLOWED_USER_ID


async def execute(interaction: discord.Interaction, action: str, section: str, wallhop: str, username: str = ''):
    if not permitted(interaction):
        await interaction.response.send_message('❌ You do not have permission to manage Victors.', ephemeral=True)
        return
    wallhop = ' '.join(wallhop.split())
    if not wallhop or len(wallhop) > 180:
        await interaction.response.send_message('❌ Enter an exact wallhop title (max 180 characters).', ephemeral=True)
        return
    if action != 'list' and not re.fullmatch(r'[A-Za-z0-9_]{3,20}', username):
        await interaction.response.send_message('❌ Enter a Roblox username of 3–20 letters, numbers or underscores.', ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True, thinking=True)
    try:
        result = await asyncio.to_thread(send_request, action, section, wallhop, username)
        if not result.get('ok'):
            message = '❌ ' + str(result.get('error') or 'Unknown Google Sheets error')[:1600]
        else:
            title = str(result.get('wallhop') or wallhop)
            sheet = 'PC' if section == 'pc' else 'Legacy'
            status = result.get('status')
            count = result.get('count', 0)
            if status == 'added':
                message = f'✅ Added **{username}** to **{title}** ({sheet}). Now {count} Victors.'
            elif status == 'exists':
                message = f'ℹ️ **{username}** is already registered for **{title}** ({sheet}).'
            elif status == 'removed':
                message = f'✅ Removed **{username}** from **{title}** ({sheet}). Now {count} Victors.'
            elif status == 'missing':
                message = f'ℹ️ **{username}** was not registered for **{title}** ({sheet}).'
            elif status == 'listed':
                names = result.get('victors', [])
                displayed = ', '.join(names) if names else '(none)'
                message = f'**{title}** ({sheet}) — {count} Victors\n{displayed}'
                if len(message) > 1850:
                    message = message[:1825] + '… (truncated)'
            else:
                message = '⚠️ Google returned an unexpected status; check the note in column M.'
    except Exception as exc:
        # Never echo the bot token, shared secret or entire HTTP payload.
        message = '⚠️ Could not contact the Google Sheet: ' + str(exc)[:1300]
    await interaction.followup.send(message, ephemeral=True, allowed_mentions=discord.AllowedMentions.none())


@victor.command(name='add', description='Add a Victor to the M-column note')
@app_commands.describe(list_type='PC or Legacy list', wallhop='Exact wallhop title (column B)', username='Roblox username')
@app_commands.rename(list_type='list')
@app_commands.choices(list_type=SECTIONS)
async def victor_add(interaction: discord.Interaction, list_type: app_commands.Choice[str], wallhop: str, username: str):
    await execute(interaction, 'add', list_type.value, wallhop, username)


@victor.command(name='remove', description='Remove a Victor from the M-column note')
@app_commands.describe(list_type='PC or Legacy list', wallhop='Exact wallhop title (column B)', username='Roblox username')
@app_commands.rename(list_type='list')
@app_commands.choices(list_type=SECTIONS)
async def victor_remove(interaction: discord.Interaction, list_type: app_commands.Choice[str], wallhop: str, username: str):
    await execute(interaction, 'remove', list_type.value, wallhop, username)


@victor.command(name='list', description='Show Victors from the M-column note')
@app_commands.describe(list_type='PC or Legacy list', wallhop='Exact wallhop title (column B)')
@app_commands.rename(list_type='list')
@app_commands.choices(list_type=SECTIONS)
async def victor_list(interaction: discord.Interaction, list_type: app_commands.Choice[str], wallhop: str):
    await execute(interaction, 'list', list_type.value, wallhop)


class VictorBot(discord.Client):
    def __init__(self):
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        self.tree.add_command(victor, guild=GUILD)
        synced = await self.tree.sync(guild=GUILD)
        print(f'Registered {len(synced)} command group(s) on guild {GUILD_ID}')

    async def on_ready(self):
        print(f'Logged in as {self.user}; /victor add, /victor remove, /victor list are ready.')


if __name__ == '__main__':
    VictorBot().run(TOKEN)
