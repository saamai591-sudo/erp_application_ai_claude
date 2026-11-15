CREATE PROCEDURE [CFG].[ApplyDbVersion] (@version VARCHAR(50))
AS


	INSERT INTO cfg.VersionInfo
	(
		-- VersionInfoID -- this column value is auto-generated
		SystemVersion,
		DbVersion,
		EnumVersion,
		VersionDate,
		ApplyDate
	)
	
	SELECT TOP 1 vi.SystemVersion, @version, vi.EnumVersion, vi.VersionDate,
	       cfg.GetCLRSaturnDate(GETDATE(),'YYYY/MM/DD',1,0)
	  FROM cfg.VersionInfo AS vi
	ORDER BY vi.VersionInfoID desc
	


