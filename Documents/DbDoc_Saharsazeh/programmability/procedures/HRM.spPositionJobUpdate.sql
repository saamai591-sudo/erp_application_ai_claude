CREATE PROC [HRM].[spPositionJobUpdate] 
    @PositionJobID INT,
    @PositionID INT,
    @JobID INT,
    @Vacancy SMALLINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 
    SET XACT_ABORT ON  

    IF @Version = (
           SELECT [Version]
           FROM   [HRM].[PositionJob]
           WHERE  [PositionJobID] = @PositionJobID
       )
    BEGIN
        DECLARE @OldJobId       INT,
                @OldVacancy     SMALLINT
    
        SELECT @OldJobId = pj.JobID,
               @OldVacancy = pj.Vacancy
        FROM   hrm.PositionJob AS pj
        WHERE  pj.PositionJobID = @PositionJobID
    
        IF (@OldJobId <> @JobID)
        BEGIN
            IF EXISTS (
                   SELECT 1
                   FROM   hrm.Agreement AS a
                   WHERE  a.PositionID = @PositionId
                          AND @OldJobId = a.JobID
               )
            BEGIN
                RAISERROR(
                    'شغل مورد نظر در قرار داد استفاده شده و امکان تغيير آن نمي باشد.',
                    16,
                    12
                )
                RETURN;
            END
        END
    
        IF (@OldVacancy <> @Vacancy)
        BEGIN
    	    DECLARE @Count int
            SELECT @Count= COUNT(*)
            FROM   (
                       SELECT T.PersonelID
                       FROM   (
                                  SELECT *
                                  FROM   (
                                             SELECT *,
                                                    ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS 
                                                    Rno
                                             FROM   hrm.ChangePersonelStatus cps
                                             WHERE  cps.ChangeDate <= GETDATE()
                                         )T1
                                  WHERE  Rno = 1
                              )T
                       WHERE  T.[Status] = 5
                   )P
                   INNER JOIN (
                            SELECT a.JobID,
                                   a.PersonelID,
                                   a.PositionID,
                                   ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
                                   RNo
                            FROM   hrm.Agreement AS a
                        )a
                        ON  a.PersonelID = p.PersonelID
                        AND a.RNo = 1
                        AND a.PositionID = @PositionId
                        AND a.JobID=@JobID
       
             IF IsNull(@Count,0)>@Vacancy
             BEGIN
         	     RAISERROR(
                    'ظرفيت استفاده شده بيشتر از ظرفيت مشخص شده مي باشد.',
                    16,
                    12
                )
	            RETURN
             END
        END
    
        UPDATE [HRM].[PositionJob]
        SET    [PositionID] = @PositionID,
               [JobID] = @JobID,
               [Vacancy] = @Vacancy,
               [Creator] = @Creator,
               [CreationDate] = @CreationDate,
               [LastEditor] = @LastEditor,
               [LastEditionDate] = @LastEditionDate,
               [Version] = @Version
        WHERE  [PositionJobID] = @PositionJobID
    
        -- Begin Return Select <- do not remove
        SELECT  [Version]
	    FROM   [HRM].[PositionJob]
        WHERE  [PositionJobID] = @PositionJobID 
        -- End Return Select <- do not remove
    END
