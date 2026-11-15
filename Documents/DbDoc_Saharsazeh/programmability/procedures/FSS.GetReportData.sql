

CREATE   PROCEDURE [FSS].[GetReportData]
    (
      @ReportID INT ,
      @addNoteColumn BIT = 0 ,
      @applyImportanceLevel BIT = 0
    )
AS
    DECLARE @DataType TINYINT,
	        @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	


	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture    

    SELECT  @DataType = DataType
    FROM    FSS.Report
    WHERE   ReportID = @ReportID;

    DECLARE @SelectQuery VARCHAR(MAX) ,
        @SumSelectQuery VARCHAR(MAX) ,
        @Columns VARCHAR(MAX) ,
        @Query NVARCHAR(MAX) ,
        @JoinQuery VARCHAR(MAX) ,
        @NoteQuery VARCHAR(MAX) ,
        @tempTableName VARCHAR(250);




    SET @tempTableName = CFG.getTempTableName(1);


    IF ( @addNoteColumn = 1 )
        BEGIN
	
            SET @NoteQuery = ' UNION 
	SELECT   ReportColumnID,r2.Number AS [Value],
TopicID AS ItemId 
FROM fss.ReportColumn
INNER JOIN FSS.Topic
ON fss.ReportColumn.ReportID= FSS.Topic.ParentReportID
INNER JOIN FSS.Report R2
ON FSS.Topic.ReferReportID=R2.ReportID
WHERE fss.ReportColumn.ReportID=' + CAST(@ReportID AS VARCHAR(10)) + '
AND ColumnType=4 ';

        END;
    ELSE
        SET @NoteQuery = '';


    SELECT  @SelectQuery = STUFF(
	           (SELECT  ',' + QUOTENAME(ReportColumnID) + ' as C'
                        + CAST(ReportColumnID AS VARCHAR(10))
                FROM    FSS.ReportColumn
                WHERE   ReportID = @ReportID
            FOR                  XML PATH('') ,
                                     TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

    SELECT  @SumSelectQuery = STUFF(
	           (SELECT  ',Sum(C' + CAST(ReportColumnID AS VARCHAR(10))
                        + ') as C' + CAST(ReportColumnID AS VARCHAR(10))
                FROM    FSS.ReportColumn
                WHERE   ReportID = @ReportID
            FOR                     XML PATH('') ,
                                        TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

    SELECT  @Columns = STUFF(
	           (SELECT DISTINCT
                        ',' + QUOTENAME(ReportColumnID)
                FROM    FSS.ReportColumn
                WHERE   ReportID = @ReportID
            FOR              XML PATH('') ,
                                 TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

    IF @DataType = 1
        SET @JoinQuery = ' Inner join Acc.Dl Item
		on Item.DlId=TData.ItemId ';
    ELSE
        SET @JoinQuery = ' Inner join FSS.Topic Item
		on Item.TopicId=TData.ItemId ';


    DECLARE @LevelQuery VARCHAR(250);

    IF @DataType = 1
        SET @LevelQuery = '';
    ELSE
        SET @LevelQuery = ' ,Item.Level,Item.Number as TopicNumber,Item.DataType';


    SET @Query = '
	SELECT ItemId,' + @SelectQuery + ',Item.Title as ItemTitle ' + @LevelQuery
        + '
	into ' + @tempTableName + '
FROM
(
select  * from 
(	SELECT  ReportColumnID,Value,
CASE DataType WHEN 1 THEN DlID ELSE TopicID END AS ItemId 
FROM fss.ReportResult
INNER JOIN FSS.Report
ON Report.ReportID = ReportResult.ReportID
	WHERE Report.ReportID=' + CAST(@ReportID AS VARCHAR(10)) + ' '
        + @NoteQuery + ' 
	) AS SourceTable
PIVOT
(
Max(Value)
FOR ReportColumnID IN (' + @Columns + ')
) AS PivotTabl ) TData' + @JoinQuery;




    PRINT @Query;
    EXEC(@Query);

    DECLARE @Sort VARCHAR(MAX);

    SET @Sort = '';

    IF @applyImportanceLevel = 1
        BEGIN

            DECLARE @ImportanceLevelColumn INT ,
                @ImportanceLevelValue DECIMAL(18, 4) ,
                @SortBaseColumn INT ,
                @SortBaseType INT;

            SELECT  @ImportanceLevelColumn = ImportanceLevelColumn ,
                    @ImportanceLevelValue = ImportanceLevelValue ,
                    @SortBaseColumn = SortBaseColumn ,
                    @SortBaseType = SortBaseType
            FROM    FSS.CodingReportStructure
            WHERE   ReportID = @ReportID;


            IF ( @ImportanceLevelColumn IS NOT NULL
                 AND @ImportanceLevelValue IS NOT NULL
               )
                BEGIN
				

                    DECLARE @TempTable2 VARCHAR(50);

                    SET @TempTable2 = CFG.getTempTableName(1);

                    SET @Query = 'select ItemId into ' + @TempTable2
                        + ' from ' + @tempTableName + ' Where C'
                        + CAST(@ImportanceLevelColumn AS VARCHAR(10)) + ' <= '
                        + CAST(@ImportanceLevelValue AS VARCHAR(50));
                    PRINT @Query;
                    EXEC(@Query);

                    SET @Query = '
					if exists(select 1 from ' + @TempTable2 + ')
					insert into ' + @tempTableName + ' SELECT -1 , '
                        + @SumSelectQuery + ' , ''سایر''  from '
                        + @tempTableName
                        + ' Where ItemId in (select ItemId from '
                        + @TempTable2 + ') Having(Sum(C'+CAST(@ImportanceLevelColumn AS VARCHAR(10))+'))>0';
                    PRINT @Query;
                    EXEC(@Query);


                    SET @Query = 'Delete From  ' + @tempTableName
                        + ' Where ItemId in (select ItemId from '
                        + @TempTable2 + ')';
                    PRINT @Query;
                    EXEC(@Query);

                    
				--EXEC(@Query)

                END;

            IF ( @SortBaseColumn IS NOT NULL
                 AND @SortBaseType IS NOT NULL
               )
                BEGIN
                    SET @Sort = ' Order by case When ItemId=-1 then -9999999999999 Else  C'
                        + CAST(@SortBaseColumn AS VARCHAR(10)) + ' End';
                    IF @SortBaseType = 1
                        SET @Sort = @Sort + ' desc';
                END;
            ELSE
                SET @Sort = ' order by ItemId desc';

        END;
    IF @DataType = 2
        SET @Sort = ' Order by TopicNumber';



  IF @applyImportanceLevel=1 AND @DataType=2
  BEGIN
	   SET @Query = 'Insert into  '+ @tempTableName + '(ItemId,ItemTitle,Level,TopicNumber,DataType)'
                        + ' select 0,						
						case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then d.Title
	                         when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then d.Title2
	                    end as Title, 
						level,Number,DataType
						from Fss.Topic Where  DataType=1 AND ParentReportID=' + CAST(@ReportID AS VARCHAR(10));
                    PRINT @Query;
                  EXEC(@Query);

  End


    EXEC ('select * from ' +  @tempTableName+ ' '+@Sort);

