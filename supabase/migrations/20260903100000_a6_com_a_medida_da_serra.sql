-- A placa A6 mede 103 x 153 mm, e nao 107 x 150.
--
-- As 107x150 vieram do primeiro lote, medidas no olho. O acrilico que a Eucodo
-- corta hoje sai 103 de largura por 153 de altura: mais estreito e mais alto do
-- que o cadastro dizia. A arte e desenhada por proporcao da largura util, entao
-- a medida errada nao aparecia como erro na tela — aparecia na hora de colar a
-- arte impressa na placa, com 4 mm sobrando de um lado e faltando 3 embaixo.
--
-- A margem de seguranca continua 7 mm: o que mudou foi so o retangulo de fora.
--
-- O `where` casa a medida antiga em vez de casar o nome. Quem ja mexeu na
-- medida do proprio produto tinha um motivo, e nao e este update que vai
-- desfazer: so volta ao lugar o que ainda esta no valor que veio da clonagem.

update public.catalogo_modelo
   set largura_mm = 103, altura_mm = 153
 where largura_mm = 107 and altura_mm = 150;

update public.produto_avaliacao
   set largura_mm = 103, altura_mm = 153
 where largura_mm = 107 and altura_mm = 150;
