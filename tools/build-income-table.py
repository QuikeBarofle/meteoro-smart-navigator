from decimal import Decimal
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont('Helvetica', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Helvetica-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

ROOT = Path(__file__).resolve().parents[1]
ROWS = [(750,'529.50'),(1000,'556.00'),(1250,'582.50'),(1500,'609.00'),
        (1750,'635.50'),(2000,'662.00'),(2250,'688.50'),(2500,'715.00'),
        (3000,'768.00'),(3500,'821.00'),(4000,'874.00'),(4500,'927.00'),(5000,'980.00')]
EXPECTED = ['193267.50','202940.00','212612.50','222285.00','231957.50',
            '241630.00','251302.50','260975.00','280320.00','299665.00',
            '319010.00','338355.00','357700.00']
for (_, daily), total in zip(ROWS,EXPECTED):
    assert Decimal(daily)*365 == Decimal(total)

out = ROOT/'docs/Income_Protector_Hospitalizacion_16x9.pdf'
c = canvas.Canvas(str(out), pagesize=(1600,900))
c.setTitle('Income Protector - Beneficio diario de hospitalización')
c.setAuthor('Carlos Barona - Meteoro Smart Navigator')
navy='#102D43'; teal='#077F86'; gray='#506575'
c.setFillColor(HexColor('#F3F7FA'));c.rect(0,0,1600,900,fill=1,stroke=0)
c.setFillColor(HexColor(navy));c.rect(0,728,1600,172,fill=1,stroke=0)
c.setFillColor(HexColor('#6FD6D3'));c.setFont('Helvetica-Bold',18)
c.drawString(80,852,'PROTECTOR DE INGRESOS')
c.setFillColor(HexColor('#FFFFFF'));c.setFont('Helvetica-Bold',44)
c.drawString(80,790,'Beneficio diario de hospitalización')
c.setFont('Helvetica',21);c.drawString(80,752,'Income Protector  |  Tabla de referencia')
x=80; widths=[470,470,500]; top=694; header=64; rowh=36
c.setFillColor(HexColor(teal));c.roundRect(x,top-header,sum(widths),header,8,fill=1,stroke=0)
c.setFillColor(HexColor('#FFFFFF'));c.setFont('Helvetica-Bold',22)
for col,title in enumerate(['Ingreso a reemplazar / mes','Beneficio diario','Total para 365 días*']):
    c.drawCentredString(x+sum(widths[:col])+widths[col]/2,top-39,title)
for i,((monthly,daily),total) in enumerate(zip(ROWS,EXPECTED)):
    y=top-header-(i+1)*rowh
    c.setFillColor(HexColor('#FFFFFF' if i%2==0 else '#E7F0F5'));c.rect(x,y,sum(widths),rowh,fill=1,stroke=0)
    for col,value in enumerate([Decimal(monthly),Decimal(daily),Decimal(total)]):
        c.setFillColor(HexColor(teal if col==1 else navy));c.setFont('Helvetica-Bold' if col==1 else 'Helvetica',24)
        c.drawRightString(x+sum(widths[:col+1])-44,y+10,f'${value:,.2f}')
c.setFillColor(HexColor(navy));c.setFont('Helvetica-Bold',17)
c.drawString(80,128,'* Beneficio diario × 365. El brochure establece un máximo de 365 días por hospitalización.')
c.setFillColor(HexColor(gray));c.setFont('Helvetica',16)
c.drawString(80,98,'Requiere discapacidad total e internación durante la noche, conforme a las condiciones de la póliza.')
c.drawString(80,70,'Montos transcritos de la tabla aportada por Carlos Barona; cálculos comprobados. No es un cuadro oficial del emisor.')
c.setFont('Helvetica',13);c.drawString(80,36,'Fuente contractual: Protector de Ingresos, C-IP-PRS-FL-S-1019, pág. 7. Montos específicos: tabla aportada, pendiente de cotejo contractual.')
c.drawRightString(1520,36,'CEB 2026')
c.showPage();c.save()
print(out)
