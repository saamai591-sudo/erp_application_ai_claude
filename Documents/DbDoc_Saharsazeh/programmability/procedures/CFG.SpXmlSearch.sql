CREATE PROCEDURE [CFG].[SpXmlSearch]
	@FromDate varchar(10)=NULL,
	@ToDate varchar(10)=NULL,
	@Operation		varchar(255)=NULL,
	@TableName	nvarchar(50),
	@WhereClause varchar(max)=NULL,
	@Schema varchar(50)=NULL,
	@Help bit=0,
	@tempTableName VARCHAR(100)=null
	

	--with encryption
AS
BEGIN

	SET NOCOUNT ON;
	SET ANSI_PADDING ON;

	
DECLARE @UnionTable nvarchar(max)                       
DECLARE @DataType nvarchar(50)
DECLARE @max_length nvarchar(50)
DECLARE @ColumnName nvarchar(max)
DECLARE @PrimarykeyCol nvarchar(max)   
DECLARE @Tsql nvarchar(max)
DECLARE @InnerWhereClause nvarchar(max)

SET @FromDate	=ISNULL(replace(@FromDate,'/',''),'13000101')
SET @ToDate		=ISNULL(replace(@ToDate,'/',''),'19990101')




IF(@Help=1)	
	Select 1 AS OperationCode,'درج' AS OperationTitle
	UNION 		
	Select 2,'حذف'	
	UNION 
	Select 3,'به روزرساني'	

/* تمامي جداول داراي نام XMLLOG را يکي مي کند */	
SET @UnionTable = cast(
(
SELECT ' SELECT '+name+'.* FROM CFG.'+ name +' UNION ALL ' AS UnionStatement
FROM   sys.tables
WHERE  name LIKE 'XMLLog%'
 AND  substring(name,7,len(name)) BETWEEN @FromDate AND @ToDate
  AND  name <> 'XMLLog' 
FOR xml raw,elements, type  ).query(
'for $UnionStatement in (row/UnionStatement)
return concat ($UnionStatement,"")')AS nvarchar(max))	

/* ستون هاي جداول موجود در ستون XMLDatas را استخراج مي کند */
SET @ColumnName = Cast((
SELECT ' Roots.Row.value(''./'+ sc.name +'[1]'','''+ st.name+ CASE 
WHEN sc.system_type_id NOT IN (167, 175, 231, 239, 241) THEN ''
ELSE '(' +case when sc.max_length = -1 then 'max' else cast(sc.max_length AS nvarchar(500)) end+')'
END +''') ' +CASE
 WHEN sc.name='Version' THEN '[نسخه]' 
 WHEN sc.name='Creator' THEN '[ايجاد کننده]'
 WHEN sc.name='CreationDate' THEN '[تاريخ ايجاد]'
 WHEN sc.name='LastEditor' THEN '[آخرين تغيير دهنده]'
 WHEN sc.name='LastEditionDate' THEN '[تاريخ آخرين تغيير]'
 ELSE  '['+ISNULL(mdef.Title, sc.name)+']' end AS CocatCol 
FROM sys.columns sc
INNER JOIN sys.types st 
ON   sc.system_type_id = st.user_type_id
INNER JOIN sys.tables t
ON t.object_id=sc.object_id
LEFT JOIN MDT.MetaDataEntity AS mde
ON mde.[Table]=t.name
LEFT JOIN MDT.MetaDataEntityField AS mdef
         ON mdef.MetaDataEntityID = mde.MetaDataEntityID
         AND mdef.Name=sc.name
WHERE  t.name =@TableName
AND st.schema_Id=4 AND sc.system_type_id<>34
for xml raw,elements, type ).query(
			'
				for $CocatCol in (row/CocatCol)
				return concat($CocatCol,",")
			'
) as nvarchar(max))




/* کليد اوليه را براي مرتب کردن داده هاي خروجي بدست مي آورد */
SET @PrimarykeyCol = cast(
	(
		  SELECT sc.name AS PrimaryCol
   		  FROM sys.indexes AS i
		  INNER JOIN sys.index_columns AS ic
    	  ON i.object_id = ic.object_id AND i.index_id = ic.index_id 
    	   INNER JOIN sys.columns sc ON sc.column_id=ic.column_id and sc.object_id=ic.object_id
		  WHERE ic.object_id= (
               SELECT t.object_id
               FROM   sys.tables t
               WHERE  t.name =@TableName) And i.is_primary_key = 1 
FOR xml raw,elements, type  ).query('for $PrimaryCol in (row/PrimaryCol)
return concat ($PrimaryCol," , ")')AS nvarchar(max))	


DECLARE @TempTableAppnedQuery VARCHAR(256)

SET @TempTableAppnedQuery=''

IF @tempTableName IS NOT NULL
	set @TempTableAppnedQuery =  ' into '+@tempTableName


/* بازيابي رکوردها از جداول Log */
SET @Tsql = 'WITH CteLog (XmlLogId,TableName,Operation , ModifiedDate,ComputerName,UserId,XmlDatas,XmlDatasNew)
				  AS (@UnionTable SELECT XMLLog.* FROM CFG.XMLLog )
SELECT * '+ @TempTableAppnedQuery +'  FROM(
			 SELECT *  FROM (SELECT  @ColumnName  cl.TableName as [نام جدول],
									cast(datepart(hh,cl.ModifiedDate) AS varchar(2))+'':''+cast(datepart(n,cl.ModifiedDate)AS varchar(2))+'':''+cast(datepart(ss,cl.ModifiedDate) AS varchar(2))
									 as [زمان عمليات],
									CFG.GregorianToShamsi(cl.ModifiedDate) AS [تاريخ عمليات],
									cl.ComputerName as [ادرس کلاينت],cl.UserId as [کليد کاربر],cl.Operation as [نوع عمليات],CASE WHEN cl.Operation in (1,2) THEN ''''
																   WHEN cl.Operation=3 THEN ''وضعیت قبل'' END as [وضعيت],cl.XmlLogId as [شناسه تغییرات] 
             FROM CteLog cl 
			 CROSS apply Xmldatas.nodes(''/row'') Roots(Row)
			 WHERE Replace(Replace(cl.TableName,'']'',''''),''['','''')=''@TableName''  @Operation ) AS TLog  @WhereClause
		UNION     
			 SELECT * FROM (SELECT  @ColumnName  cl.TableName, 
									cast(datepart(hh,cl.ModifiedDate) AS varchar(2))+'':''+cast(datepart(n,cl.ModifiedDate)AS varchar(2))+'':''+cast(datepart(ss,cl.ModifiedDate) AS varchar(2)) as ModifiesdTime,
									CFG.GregorianToShamsi(cl.ModifiedDate) AS LogModifiedDate,
									cl.ComputerName,cl.UserId,cl.Operation,''وضعیت جدید'' as   [وضعيت],cl.XmlLogId  as [شناسه تغییرات] 
             FROM CteLog cl 
			 CROSS apply XmlDatasNew.nodes(''/row'') Roots(Row)
			 WHERE Replace(Replace(cl.TableName,'']'',''''),''['','''')=''@TableName'' @Operation ) AS TLog @WhereClause 											  
              ) as q  order by [شناسه تغییرات] asc, [وضعيت]'


	
 SET @Tsql=replace(@Tsql,'@FromDate',@FromDate)
 SET @Tsql=replace(@Tsql,'@Todate',@ToDate)											  
 SET @Tsql=replace(@Tsql,'@UnionTable',isnull(@UnionTable,''))
 SET @Tsql=replace(@Tsql,'@TableName',CASE WHEN @Schema  IS NULL THEN @TableName ELSE @Schema+'.'+@TableName END )
 SET @Tsql=replace(@Tsql,'@Operation',CASE WHEN @Operation IS NULL THEN '' ELSE  ' AND cl.Operation in '+@Operation END)
 SET @Tsql=replace(@Tsql,'@ColumnName',@ColumnName)
 SET @Tsql=replace(@Tsql,'@WhereClause',CASE  WHEN @WhereClause IS NULL THEN '' ELSE ' WHERE '+@WhereClause  END)
 SET @Tsql=replace(@Tsql,'@PrimarykeyCol',ISNULL(@PrimarykeyCol,''))


   EXEC(@Tsql)


                                 
END
