
CREATE    PROC [CFG].[TableFromIStuffTraceString]
    (
        @SelectedStuff NVARCHAR(MAX) ,
        @TableName NVARCHAR(MAX) ,
        @PricingBase BIT = 0 ,
        @checkInventroy BIT = 0
    )
--WITH ENCRYPTION
AS
    IF OBJECT_ID('tempdb..' + @TableName) IS NOT NULL
        BEGIN
            DECLARE @Q VARCHAR(1024);
            SET @Q = 'Drop Table ' + @TableName;
            EXEC ( @Q );
        END;

    DECLARE @SelectComand NVARCHAR(MAX) = '' ,
            @Query NVARCHAR(MAX) = '' ,
            @Param NVARCHAR(MAX) ,
            @CharIndex INT ,
            @CreateTableQuery NVARCHAR(MAX) ,
            @Columns NVARCHAR(MAX);

    SET @Param = N'@pSelectedStuff nvarchar(max), @pNull nvarchar(max)';
    SELECT @CharIndex = CHARINDEX(
                            '$' ,
                            CFG.GetStringPartBySpliter(@SelectedStuff, 1, '|'),
                            1);

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ' ,' + QUOTENAME(TraceID) + 'nvarchar(max)'
        FROM   STF.Trace
        WHERE  (   @checkInventroy = 0
                   OR CheckInventory = 1 )
               AND (   @PricingBase = 0
                       OR PricingBase = 1 )
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @Columns IS NULL )
        SET @Columns = '';



    IF ( @CharIndex = 0 )
        BEGIN
            SET @CreateTableQuery = 'Create table ' + @TableName
                                    + '(
		ID int,
Position int,
StuffID int '                       + @Columns + '
)'          ;

            EXEC ( @CreateTableQuery );

            SELECT @SelectComand = STUFF(
            (   SELECT DISTINCT ' ,case when lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'')) = ''null''
then @pNull when lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'') ) <> ''null''
then lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'') ) END ' ,
                       QUOTENAME(TraceID)
                FROM   STF.Trace
                WHERE  (   @checkInventroy = 0
                           OR CheckInventory = 1 )
                       AND (   @PricingBase = 0
                               OR PricingBase = 1 )
                FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
            1   ,
            1   ,
            ''  );

            IF ( @SelectComand IS NULL )
                SET @SelectComand = '';

            SET @Query = 'INSERT INTO ' + @TableName
                         + ' select  Position,Position,CFG.GetStringPartBySpliter(value,1,''#'') StuffID '
                         + @SelectComand
                         + 'from cfg.R_FnStr2TableBySplitor(@pSelectedStuff,''|'')';

         


            EXECUTE sp_executesql @Query ,
                                  @Param ,
                                  @pSelectedStuff = @SelectedStuff ,
                                  @pNull = NULL;
        END;

    IF ( @CharIndex > 0 )
        BEGIN
            SET @CreateTableQuery = 'Create table ' + @TableName
                                    + '(
ID int,
Position int,
StuffID int ,
StockID int'              + @Columns + '
)'          ;

            EXEC ( @CreateTableQuery );

            SELECT @SelectComand = STUFF(
            (   SELECT DISTINCT ' ,case when lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'')) = ''null''
then @pNull when lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'') ) <> ''null''
then lower(cfg.GetStringPartBySpliter(substring(value,Charindex(''#'',VALUE,1)+1,LEN(value)),' ,
                       ROW_NUMBER() OVER ( ORDER BY TraceID ) ,
                       ',''^'') ) END ' ,
                       QUOTENAME(TraceID)
                FROM   STF.Trace
                WHERE  (   @checkInventroy = 0
                           OR CheckInventory = 1 )
                       AND (   @PricingBase = 0
                               OR PricingBase = 1 )
                FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
            1   ,
            1   ,
            ''  );

            IF ( @SelectComand IS NULL )
                SET @SelectComand = '';

            IF @PricingBase = 0
                BEGIN
                    SET @Query = 'INSERT INTO ' + @TableName
                                 + ' 
		select  Position,Position,cfg.GetStringPartBySpliter(CFG.GetStringPartBySpliter(value,1,''#''),1,''$'') StuffID,
		cfg.GetStringPartBySpliter(CFG.GetStringPartBySpliter(value,1,''#''),2,''$'') StockID
		 '                       + @SelectComand
                                 + ' 
		from cfg.R_FnStr2TableBySplitor(@pSelectedStuff,''|'')';

                    EXECUTE sp_executesql @Query ,
                                          @Param ,
                                          @pSelectedStuff = @SelectedStuff ,
                                          @pNull = NULL;
                END;

            IF @PricingBase = 1
                BEGIN
                    SELECT @Columns = STUFF(
                    (   SELECT DISTINCT ',' + QUOTENAME(TraceID)
                        FROM   STF.Trace
                        WHERE  PricingBase = 1
                        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
                    1   ,
                    0   ,
                    ''  );

                    IF ( @Columns IS NULL )
                        SET @Columns = '';


                    SET @Query = 'INSERT INTO ' + @TableName
                                 + ' 
		select  Position,Position,cfg.GetStringPartBySpliter(CFG.GetStringPartBySpliter(value,1,''#''),1,''$'') StuffID,
		cfg.GetStringPartBySpliter(CFG.GetStringPartBySpliter(value,1,''#''),2,''$'') StockID
		 '                       + @SelectComand
                                 + ' 
		from cfg.R_FnStr2TableBySplitor(@pSelectedStuff,''|'')

		;with temp as (
			select  ID, Rank() over(order by stuffid' + @Columns
                                 + ') as Position
			from    '            + @TableName
                                 + ' )

		update v
		set Position = vi.Position
		from '                   + @TableName
                                 + '  v
		join temp vi  on v.ID = vi.ID

		'           ;

                    EXECUTE sp_executesql @Query ,
                                          @Param ,
                                          @pSelectedStuff = @SelectedStuff ,
                                          @pNull = NULL;
                END;
        END;
