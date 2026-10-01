"""Render an annotated design walkthrough from captured prototype screens.

No browser automation or fabricated UI: every screen comes from an actual interaction.
Usage: python scripts/render-design-demo.py [--preview-only]
Requires Pillow and FFmpeg. Outputs remain local under artifacts/design-demo/.
"""
from pathlib import Path
import argparse
import json
import math
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'design-demo'
W, H, FPS = 1920, 1080, 24
BG, INK, MUTED, BLUE = '#080b11', '#eef1f6', '#9aa9bc', '#a8d3ff'
FONT_DIR = Path('C:/Windows/Fonts')

def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)

# Editorial annotations describe the design, not production implementation claims.
TEXT = [
('01-profiles','Overview','One shared tool record','A focused workspace for foremen, warehouse managers, and administrators.'),
('02-my-tools','Foreman','Your tools. Clear next steps.','Incoming handoffs, outgoing transfers, and personal custody stay distinct.'),
('03-accept','Foreman','Inspect. Then accept.','The recipient confirms condition before taking custody. Notes and photos stay optional.'),
('04-edit-transfer','Foreman','Keep a handoff editable','Update the recipient or handoff note. Cancel if plans change.'),
('05-navigation','Foreman','One navigation language','Tools, jobs, crew visibility, and appearance live in the same simple menu.'),
('06-filters','Foreman','Find what is available','Available-only starts on. Filter by yard and category before choosing a tool.'),
('07-choose-unit','Foreman','Choose the yard, not a guess','Matching tools are grouped. Select a specific warehouse unit inside the handoff.'),
('08-request-sent','Foreman','A request is not custody','The warehouse releases the selected unit. The request remains visible until then.'),
('09-person-search','Foreman','The same dropdown, with search','Find a teammate without switching to a different input pattern.'),
('10-send-person','Foreman','A clear handoff, not a silent move','Send to Eli. The tool stays with Ray until Eli accepts.'),
('11-my-jobs','Jobs & crew','Jobs stay separate from tools','Join more than one job. Changing assignments does not move tool custody.'),
('12-crew-search','Jobs & crew','Find the tool through the crew','Search expands the matching foreman and shows matching tools—not unrelated rows.'),
('13-recipient','Handoffs','The other side is just as clear','Eli sees who sent the drill, the handoff note, and the inspection confirmation.'),
('14-custody-updated','Handoffs','Now it is in Eli’s custody','The accepted unit moves into My tools. Its history stays attached to the same tool ID.'),
('15-return-yard','Handoffs','Return through a normal handoff','Choose the receiving warehouse. A manager accepts it back into stock.'),
('16-mobile-queue','Warehouse','Start where the work is','The warehouse opens on its queue. Release and accept are immediately visible.'),
('17-inventory-groups','Warehouse','Grouped visually. Tracked individually.','Expand a tool family to see each unit, holder, warehouse, and status.'),
('18-inventory-drawer','Warehouse','Manage the unit in one drawer','Edit and force return share the row. Mark damaged or lost while the tool is checked out.'),
('19-damage-report','Warehouse','Flag condition without losing custody','A checked-out tool can be marked damaged or lost. The holder stays explicit.'),
('20-return-condition','Warehouse','Return does not mean repaired','The yard has custody, but the unit remains damaged until it is restored or retired.'),
('21-flagged-desktop','Warehouse','Issue, custody, action','An aligned list makes it obvious what is wrong, who has it, and what can happen next.'),
('22-flagged-mobile','Warehouse','The hierarchy survives mobile','Tool identity comes first, then custody, then actions—without oversized cards.'),
('23-decommission','Warehouse','Retire the unit, retain its history','Decommissioning archives an individual tool instead of erasing its record.'),
('24-add-tool-photo','Warehouse','Add one tool, with a real photo','Name, model, category, yard, and serial identify the unit. There is no quantity field.'),
('25-add-tool-mobile','Warehouse','Photo entry works on mobile too','The same form keeps its fields and upload preview usable on a narrow screen.'),
('26-person-record','Administration','A useful person record','Current jobs, held tools, access, and recent activity live together in the drawer.'),
('27-invitation-link','Administration','An invitation with a next step','Create the person, copy their invitation link, and preview the acceptance screen.'),
('28-accept-invitation','Administration','A focused welcome screen','The new member sees their role and home yard before entering the workspace.'),
('29-warehouses','Administration','Locations, managed consistently','Warehouses mirror people: a compact list, clear responsibility, and a detail drawer.'),
('30-manager-select','Administration','One searchable select component','Choosing a warehouse manager uses the same interaction as choosing a transfer recipient.'),
('31-settings','Administration','Configuration, kept understandable','Company details, configurable jobs, and tool categories share a restrained settings layout.'),
('32-create-job','Administration','Admins define the job list','Create a job once. Foremen choose their assignments separately from tool custody.'),
('33-job-roster','Administration','Counts lead to the people','Open a job’s foreman count to see names and custody, then go directly to a person record.'),
('34-archive-job','Administration','Archive jobs. Never delete them.','Current assignments close, history remains, and the job can be restored later.'),
('35-archived-jobs','Administration','Completed work stays in the record','Archived jobs can be restored without silently reopening old assignments.'),
('36-access','Administration','Roles have clear boundaries','Foremen request tools; warehouse managers resolve handoffs; administrators manage people.'),
('37-activity','Administration','Every handoff has a history','Filter the record to follow requests, acceptance, returns, and condition changes.'),
]

def wrap(draw, text, face, width):
    if '\n' in text:
        return [line for block in text.split('\n') for line in wrap(draw, block, face, width)]
    lines, line = [], ''
    for word in text.split():
        candidate = f'{line} {word}'.strip()
        if line and draw.textlength(candidate, font=face) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + ([line] if line else [])

def paragraph(draw, text, x, y, width, size, color=INK, bold=False, spacing=1.18):
    face = font(size, bold)
    for line in wrap(draw, text, face, width):
        draw.text((x,y), line, font=face, fill=color)
        y += round(size * spacing)
    return y

def background():
    # Quiet navy glow derived from the prototype's own colors.
    small = Image.new('RGB', (W // 8, H // 8))
    pixels = small.load()
    for y in range(small.height):
        for x in range(small.width):
            glow = math.exp(-(((x-170)/120)**2 + ((y-48)/85)**2))
            pixels[x,y] = (8 + int(3*glow), 11 + int(8*glow), 17 + int(15*glow))
    return small.resize((W,H), Image.Resampling.BICUBIC)

BACK = background()

def brand(draw):
    draw.rectangle((64,51,103,90), fill='#e4eaf3')
    draw.text((75,50),'N',font=font(29,True),fill='#10141c')
    draw.text((120,53),'NELSON ELECTRIC',font=font(23,True),fill=INK)
    draw.text((1645,56),'TOOL TRACKER',font=font(18),fill=MUTED)

def scene(shot, number, total):
    frame = BACK.copy()
    draw = ImageDraw.Draw(frame)
    brand(draw)
    screen = Image.open(OUT / 'screens' / f"{shot['key']}.png").convert('RGB')
    # Crop desktop drawers only: the UI remains untouched, just framed for readability.
    crop = None
    if shot['key'] in ('18-inventory-drawer','20-return-condition'):
        crop = (1020,0,1440,900)
    elif shot['key'] == '26-person-record':
        crop = (920,0,1440,900)
    if crop:
        screen = screen.crop(crop)
    portrait = screen.width / screen.height < 0.8
    x, width, title_size = (104,770,76) if portrait else (64,410,50)
    draw.text((x,235 if portrait else 170), shot['chapter'].upper(),font=font(19,True),fill=BLUE)
    title_y = 289 if portrait else 220
    bottom = paragraph(draw,shot['title'],x,title_y,width,title_size,bold=True,spacing=1.12)
    draw.line((x,bottom+27,x+66,bottom+27),fill=BLUE,width=3)
    paragraph(draw,shot['note'],x,bottom+58,width,30 if portrait else 26,MUTED,spacing=1.4)
    if portrait:
        scale = min(510/screen.width,880/screen.height)
        sw, sh = round(screen.width*scale), round(screen.height*scale)
        sx, sy = 1290-sw//2, 126
    else:
        scale = min(1310/screen.width,820/screen.height)
        sw, sh = round(screen.width*scale), round(screen.height*scale)
        sx, sy = 550+(1310-sw)//2, 140+(820-sh)//2
    screen = screen.resize((sw,sh),Image.Resampling.LANCZOS)
    draw.rounded_rectangle((sx-2,sy-2,sx+sw+2,sy+sh+2),radius=13,fill='#263344')
    mask=Image.new('L',(sw,sh),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1),radius=11,fill=255)
    frame.paste(screen,(sx,sy),mask)
    draw = ImageDraw.Draw(frame)
    draw.text((x,907 if portrait else 905),f'{number:02d} / {total:02d}',font=font(20),fill=BLUE)
    draw.text((x,944), 'FIELD  /  WAREHOUSE  /  ADMIN',font=font(16),fill=MUTED)
    if shot.get('focus') and not crop and shot['key'] in ('39-worker-photo','42-report-lost','43-cancel-transfer','38-light-theme'):
        f = shot['focus']
        a,b = sx+f['x']*scale, sy+f['y']*scale
        c,d = a+f['width']*scale,b+f['height']*scale
        if a>=sx and b>=sy and c<=sx+sw and d<=sy+sh:
            draw.rounded_rectangle((a-4,b-4,c+4,d+4),radius=12,outline=BLUE,width=2)
    return frame

CHAPTER_COPY={
 'Foreman':('01','Built around the field','Tools, checkout, photos, and straightforward handoffs.'),
 'Handoffs':('02','One tool. One clear handoff.','Send, accept, return, inspect, or report an issue.'),
 'Jobs & crew':('03','Know the job. Find the tool.','Independent job assignments and shared crew visibility.'),
 'Warehouse':('04','Keep the gate moving','Release requests, accept returns, and manage individual stock.'),
 'Administration':('05','A workspace you can configure','People, warehouses, jobs, access, and a visible activity record.'),
}

def title_card(title, note, label='DESIGNED FOR NELSON ELECTRIC', numeral=None):
    frame=BACK.copy(); draw=ImageDraw.Draw(frame); brand(draw)
    if numeral:
        draw.text((1400,280),numeral,font=font(340,True),fill='#132034')
    draw.text((104,275),label,font=font(23,True),fill=BLUE)
    bottom=paragraph(draw,title,104,343,1220,104,bold=True,spacing=1.1)
    paragraph(draw,note,110,bottom+54,1180,34,MUTED,spacing=1.4)
    draw.line((110,899,1810,899),fill='#233145',width=1)
    draw.text((110,937),'TOOL CUSTODY  /  JOBS  /  CREW VISIBILITY',font=font(20),fill=MUTED)
    return frame

def timecode(seconds):
    seconds=round(seconds)
    return f'{seconds//60:02d}:{seconds%60:02d}'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview-only',action='store_true');args=parser.parse_args()
    shots=[dict(key=k,chapter=c,title=t,note=n,duration=7) for k,c,t,n in TEXT]
    shots += json.loads((OUT/'extra-shots.json').read_text(encoding='utf-8'))
    # A recapture replaces its earlier editorial entry, just as it replaces the PNG.
    shots = list({shot['key']: shot for shot in shots}.values())
    order=['Overview','Foreman','Handoffs','Jobs & crew','Warehouse','Administration']
    shots.sort(key=lambda s:(order.index(s['chapter']), int(s['key'][:2])))
    for s in shots:
        if not (OUT/'screens'/f"{s['key']}.png").is_file():raise FileNotFoundError(s['key'])
    poster=title_card('The right tool.\nThe right crew.','A design walkthrough of tool custody, warehouse operations, and crew visibility.')
    poster.save(OUT/'poster.png')
    scenes=[dict(image=poster,duration=7,title='Tool Tracker — design walkthrough',note='Designed for Nelson Electric')]
    previous='Overview'
    thumbnails=[]
    for i,s in enumerate(shots,1):
        if s['chapter'] != previous:
            num,title,note=CHAPTER_COPY[s['chapter']]
            scenes.append(dict(image=title_card(title,note,f"{num} / {s['chapter'].upper()}",num),duration=4,title=s['chapter'],note=note))
            previous=s['chapter']
        img=scene(s,i,len(shots))
        img.save(OUT/f"frame-{s['key']}.jpg",quality=92)
        thumbnails.append(img.resize((480,270),Image.Resampling.LANCZOS))
        scenes.append(dict(image=img,duration=s['duration'],title=s['title'],note=s['note']))
    scenes.append(dict(image=title_card('Less searching.\nClearer handoffs.','One coherent design for the field, the warehouse, and the office.','NELSON ELECTRIC / TOOL TRACKER'),duration=7,title='Designed for Nelson Electric',note='One coherent design for the field, the warehouse, and the office.'))
    contact=Image.new('RGB',(1920,math.ceil(len(thumbnails)/4)*270),BG)
    for i,img in enumerate(thumbnails):contact.paste(img,((i%4)*480,(i//4)*270))
    contact.save(OUT/'contact-sheet.jpg',quality=90)
    elapsed=0;chapters=[];vtt=['WEBVTT\n'];notes=[];metadata=[';FFMETADATA1']
    for i,s in enumerate(scenes,1):
        start,end=elapsed,elapsed+s['duration'];elapsed=end
        notes.append(f"{timecode(start)}  {s['title']}\n    {s['note']}\n")
        def stamp(t):return f'{int(t)//3600:02d}:{int(t)%3600//60:02d}:{int(t)%60:02d}.000'
        vtt.append(f"{i}\n{stamp(start)} --> {stamp(end)}\n{s['title']}\n{s['note']}\n")
        metadata += ['[CHAPTER]','TIMEBASE=1/1000',f'START={int(start*1000)}',f'END={int(end*1000)}',f"title={s['title']}"]
        chapters.append(dict(title=s['title'],start=start,duration=s['duration']))
    (OUT/'presenter-notes.txt').write_text('\n'.join(notes),encoding='utf-8')
    (OUT/'captions.vtt').write_text('\n'.join(vtt),encoding='utf-8')
    (OUT/'chapters.ffmetadata').write_text('\n'.join(metadata),encoding='utf-8')
    (OUT/'walkthrough.json').write_text(json.dumps(dict(duration=elapsed,width=W,height=H,shots=shots,chapters=chapters),indent=2),encoding='utf-8')
    print(f'{len(shots)} annotated screens; {timecode(elapsed)} total',flush=True)
    if args.preview_only:return
    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg:raise RuntimeError('FFmpeg not installed')
    video=OUT/'Tool-Tracker-Design-Walkthrough.mp4'
    command=[ffmpeg,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-f','ffmetadata','-i',str(OUT/'chapters.ffmetadata'),'-map_metadata','1','-map_chapters','1','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE)
    done=0;total_frames=int(elapsed*FPS)
    try:
        for s in scenes:
            print('Rendering: '+s['title'],flush=True)
            fade_frames=8;count=int(s['duration']*FPS)
            for f in range(count):
                # A restrained ease-in fade introduces each screen; no synthetic UI interaction.
                amount=min(1,(f+1)/fade_frames,(count-f)/fade_frames)
                if amount<1:
                    amount=amount*amount*(3-2*amount)
                    frame=Image.blend(BACK,s['image'],amount)
                else:frame=s['image'].copy()
                draw=ImageDraw.Draw(frame)
                draw.rectangle((64,1036,1856,1039),fill='#1e2837')
                draw.rectangle((64,1036,64+int(1792*(done+1)/total_frames),1039),fill=BLUE)
                process.stdin.write(frame.tobytes());done+=1
        process.stdin.close()
        if process.wait()!=0:raise RuntimeError('Video encoding failed')
    except BaseException:
        process.kill();raise
    print(f'Video saved: {video}',flush=True)

if __name__ == '__main__':main()
