CREATE FUNCTION [CFG].[fn_XmlToJson_Get]
(
@XmlData XML
)
RETURNS NVARCHAR(MAX)
AS
BEGIN
RETURN '['+
 (SELECT STUFF(
  (SELECT
   *
   FROM
    (SELECT
      ',{'+
        STUFF(
          (SELECT
            ',"'+
             COALESCE(b.c.value('local-name(.)', 'NVARCHAR(MAX)'),'')+'":"'+Replace(Replace(REPLACE( b.c.value('text()[1]','NVARCHAR(MAX)'),'"',''),char(9),char(32)),'\','\\') +'"'
           FROM x.a.nodes('*') b(c) FOR XML PATH(''),TYPE).value('(./text())[1]','NVARCHAR(MAX)'),1,1,'')
       +'}'
     FROM @XmlData.nodes('/*') x(a)) JSON(theLine)
    FOR XML PATH(''),TYPE).value('.','NVARCHAR(MAX)' )
   ,1,1,'')) + ']'
END
