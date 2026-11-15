
CREATE   PROCEDURE [STF].GetOutDlData
(
    @traceId  INT,
    @Date     DATETIME,
    @StockID  INT,
    @StuffId  INT,
    @Traces   NVARCHAR(MAX)
)
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON;

    IF @traceId IS NULL OR @traceId <= 0 OR @StuffId IS NULL OR @StuffId <= 0
        RETURN;

    IF NOT EXISTS (
        SELECT 1
        FROM STF.Trace
        WHERE TraceID = @traceId
          AND CheckInventory = 1
    )
        RETURN;

    IF @Traces IS NULL
        SET @Traces = N'';

    IF @StockID IS NULL
        SET @StockID = 0;

    BEGIN TRY

    DECLARE @tableNameSelected  NVARCHAR(255),
            @TableName1 Nvarchar(250),
            @joinTracesString  NVARCHAR(MAX),
            @Query Nvarchar(max)


    SET @tableNameSelected=cfg.getTempTableName(1)
    SET @TableName1 = cfg.getTempTableName(1)


    -- Keep checkInventroy=1 so ^-separated values align with CheckInventory traces only
    EXEC cfg.TableFromIStuffTraceString @SelectedStuff = @Traces , -- nvarchar(max)
                                        @TableName = @tableNameSelected ,     -- nvarchar(max)
                                        @PricingBase = 0 ,  -- bit
                                        @checkInventroy = 1 -- bit


    declare @Stuffids nvarchar(100) = cast(@stuffid as nvarchar(100))



    exec stc.spGetInventoryInDate
            @StuffId  =   @Stuffids,
            @stockID =    @stockId,
            @ToDate =      @date,
            @FinalTable = @TableName1


        SELECT @joinTracesString = STUFF(
                   (
                       SELECT DISTINCT 'AND Isnull(T.' + QUOTENAME(t.TraceID) +
                                       ',-1)=Isnull(T1.' + QUOTENAME(t.TraceID) + ',-1)'
                       FROM   STF.Trace t
                       WHERE  t.CheckInventory = 1 AND
                              t.OrderView < (
                                  SELECT OrderView
                                  FROM   stf.Trace t2
                                  WHERE  t2.TraceID = @traceId
                              )
                              FOR XML PATH(''),
                              TYPE
                   ).value('.', 'NVARCHAR(MAX)'),
                   1,
                   0,
                   ''
               )

        if @joinTracesString is null
        set @joinTracesString = ''


        SET @Query = N'
                    select d.DLID,d.Code,d.Title,d.DlTypeID,d.DlTypeCode,d.IsActive,d.DlTypeTitle,d.ParentID,  T200.RealInventory, T200.ID
                      from (
                                select TRY_CONVERT(BIGINT, T1.'+QUOTENAME(@traceId)+') AS TraceDlId
                                      ,Sum(MainQuantity) as RealInventory,
                                      Row_number()  over (Order By TRY_CONVERT(BIGINT, T1.'+QUOTENAME(@traceId)+') ) as ID
                                from (
                                        select T.*
                                        from '+@TableName1+' T
                                        join '+@tableNameSelected+' T1 on T.stuffid = T1.stuffid '+@joinTracesString+'
                                      )T1
                                where TRY_CONVERT(BIGINT, T1.'+QUOTENAME(@traceId)+') IS NOT NULL
                                group by  TRY_CONVERT(BIGINT, T1.'+QUOTENAME(@traceId)+')
                            )T200
                        Inner join
                            (
                                SELECT  d.DLID,d.Code,d.Title,d.DlTypeID,dt.Code AS DlTypeCode,d.IsActive,dt.Title as DlTypeTitle,d.ParentID
                                FROM Acc.DL d
                                INNER JOIN Acc.DlType dt ON dt.DlTypeID = d.DlTypeID
                            )d  on d.DlId=T200.TraceDlId'


        PRINT @Query
        EXECUTE sp_executeSQL
                    @Query

    END TRY
    BEGIN CATCH
        -- Avoid bubbling SQL errors to API when trace/inventory data is incomplete.
    END CATCH
END

