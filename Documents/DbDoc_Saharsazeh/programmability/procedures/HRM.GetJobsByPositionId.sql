CREATE PROCEDURE [HRM].[GetJobsByPositionId](
	@PositionId INT, 
	@PersonelID INT
)
AS

	SELECT a.JobID, COUNT(*) AS Cnt
	INTO #count
	FROM   (
	           SELECT T.PersonelID
	           FROM    (
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
	           WHERE  T.[Status] =5
	                    
	       )P
	       Inner JOIN (
	                SELECT a.JobID,a.PersonelID,a.PositionID,
	                       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
	                       RNo
	                FROM   hrm.Agreement AS a
	                WHERE   a.PersonelID<>@personelID
	            )a
	            ON  a.PersonelID = p.PersonelID
	            AND a.RNo = 1
	            AND a.PositionID=@PositionId 
	GROUP BY a.JobID

	DECLARE  @Culture           VARCHAR(25),
	         @CultureNo         TINYINT
	
	SET @Culture = CFG.GetuserCulture() ;

	SELECT @CultureNo = ISNULL(CultureNo, 1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT j.JobID,
		   CASE @CultureNo WHEN 2 THEN j.Title2 ELSE   j.Title END AS Title,
		   j.Code,
		   j.InsuranceCode
	FROM   hrm.PositionJob       AS pj
	       INNER JOIN HRM.[Job]  AS j
	            ON  j.JobID = pj.JobID
	        LEFT JOIN #count cn
	        ON cn.jobId=j.JobID
	WHERE  pj.PositionID = @PositionId
	       AND pj.Vacancy > ISNULL(cn.cnt,0)
